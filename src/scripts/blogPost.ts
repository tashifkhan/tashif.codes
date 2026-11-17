/**
 * Everything interactive on a blog post page.
 *
 * Astro bundles this module and runs it once per full page load. With the
 * ClientRouter, later posts arrive by DOM swap, so each post is wired on
 * `astro:page-load` with its own AbortController, and every listener and
 * request it creates takes that controller's signal. `astro:before-swap`
 * aborts it.
 *
 * This replaces an inline script that added an `astro:page-load` listener on
 * every render and never removed it. Each stale listener kept its own slug,
 * so after visiting a few posts one Like click un-liked an earlier post and
 * one comment was posted to every post the reader had opened.
 */
import { countComments, formatPostDate } from "@/lib/blog-shared";
import { motionReduced } from "@/lib/motion";

type BlogComment = {
	id: string;
	name: string;
	text: string;
	date: string;
	replies?: BlogComment[];
};

type InitialData = { views?: number; likes?: number; comments?: BlogComment[] };

const NAME_KEY = "blog-comment-name";

const haptic = (kind: string) =>
	document.dispatchEvent(new CustomEvent("site:haptic", { detail: kind }));

const readStorage = (key: string): string | null => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

const writeStorage = (key: string, value: string | null) => {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// storage blocked: the preference just isn't remembered
	}
};

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = "",
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

/** Comment timestamps are full ISO times, so show them in the reader's zone. */
const commentDate = (iso: string) => {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? formatPostDate(iso)
		: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function initPost(root: HTMLElement, signal: AbortSignal) {
	const slug = root.dataset.slug ?? "";
	const api = root.dataset.apiBase ?? "";
	if (!slug || !api) return;

	const all = <T extends HTMLElement = HTMLElement>(selector: string) =>
		Array.from(root.querySelectorAll<T>(selector));
	const setText = (selector: string, value: string | number) =>
		all(selector).forEach((node) => (node.textContent = String(value)));

	async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const res = await fetch(`${api}${path}`, { ...init, signal });
		if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${res.status}`);
		return res.json() as Promise<T>;
	}
	const aborted = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

	let initial: InitialData = {};
	try {
		initial = JSON.parse(root.querySelector("[data-blog-post-initial]")?.textContent || "{}");
	} catch {
		initial = {};
	}

	let views = initial.views ?? 0;
	let likes = initial.likes ?? 0;
	let comments: BlogComment[] = Array.isArray(initial.comments) ? initial.comments : [];
	const likedKey = `liked-${slug}`;
	let liked = readStorage(likedKey) === "1";
	let likeBusy = false;

	// ── Engagement numbers ────────────────────────────────────────────────
	const renderViews = () => setText("[data-post-views]", views.toLocaleString("en-US"));
	const renderLikes = () => {
		setText("[data-post-likes-count]", likes.toLocaleString("en-US"));
		all("[data-post-like]").forEach((button) => button.setAttribute("aria-pressed", String(liked)));
	};

	renderViews();
	renderLikes();

	// POST records a view (deduplicated per viewer server-side); GET would not.
	request<{ views: number }>(`/views/${slug}`, { method: "POST" })
		.then((data) => {
			views = data.views;
			renderViews();
		})
		.catch(() => {});

	request<{ likes: number }>(`/likes/${slug}`)
		.then((data) => {
			likes = data.likes;
			renderLikes();
		})
		.catch(() => {});

	async function toggleLike() {
		if (likeBusy) return;
		likeBusy = true;
		const before = { liked, likes };
		liked = !liked;
		likes = Math.max(0, likes + (liked ? 1 : -1));
		renderLikes();
		try {
			const data = await request<{ likes: number }>(`/likes/${slug}`, {
				method: liked ? "POST" : "DELETE",
			});
			likes = data.likes;
			writeStorage(likedKey, liked ? "1" : null);
		} catch (err) {
			if (aborted(err)) return;
			haptic("error");
			({ liked, likes } = before);
		} finally {
			likeBusy = false;
			renderLikes();
		}
	}

	all("[data-post-like]").forEach((button) =>
		button.addEventListener("click", toggleLike, { signal }),
	);

	// ── Navigation helpers ────────────────────────────────────────────────
	const scrollBehavior = (): ScrollBehavior => (motionReduced() ? "auto" : "smooth");

	all("[data-post-discuss]").forEach((button) =>
		button.addEventListener(
			"click",
			() => document.getElementById("comments-section")?.scrollIntoView({ behavior: scrollBehavior() }),
			{ signal },
		),
	);

	const mobileToc = root.querySelector<HTMLDetailsElement>("[data-post-toc-mobile]");
	all("[data-post-contents]").forEach((button) =>
		button.addEventListener(
			"click",
			() => {
				// The post's own <Toc /> block when it has one, otherwise ours.
				const target = mobileToc ?? root.querySelector<HTMLElement>(".markdown-body .md-toc");
				if (!target) return;
				if (mobileToc) mobileToc.open = true;
				target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
			},
			{ signal },
		),
	);

	async function share(button: HTMLElement) {
		const url = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? location.href;
		const label = button.querySelector("[data-share-label]");
		const original = label?.textContent ?? "";
		const flash = (message: string) => {
			if (!label) return;
			label.textContent = message;
			setTimeout(() => (label.textContent = original), 1600);
		};
		if (navigator.share && matchMedia("(pointer: coarse)").matches) {
			try {
				await navigator.share({ title: document.title, url });
				return;
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			haptic("success");
			flash("Copied");
		} catch {
			haptic("error");
			flash("Copy failed");
		}
	}

	all("[data-post-share]").forEach((button) =>
		button.addEventListener("click", () => void share(button), { signal }),
	);

	// ── Contents, progress, header title ──────────────────────────────────
	const tocLinks = all<HTMLAnchorElement>("[data-toc-link]");
	const headingIds = [...new Set(tocLinks.map((a) => a.getAttribute("href")?.slice(1) ?? ""))];
	const headings = headingIds
		.map((id) => document.getElementById(id))
		.filter((h): h is HTMLElement => h !== null);
	const rail = root.querySelector<HTMLElement>("[data-toc-rail]");

	tocLinks.forEach((link) =>
		link.addEventListener(
			"click",
			(event) => {
				const id = link.getAttribute("href")?.slice(1);
				const target = id ? document.getElementById(id) : null;
				if (!target) return;
				event.preventDefault();
				target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
				history.replaceState(history.state, "", `#${id}`);
				if (mobileToc) mobileToc.open = false;
			},
			{ signal },
		),
	);

	let activeId = "";
	function setActive(id: string) {
		if (id === activeId) return;
		activeId = id;
		tocLinks.forEach((link) => {
			if (link.getAttribute("href") === `#${id}`) link.setAttribute("aria-current", "true");
			else link.removeAttribute("aria-current");
		});
		const current = rail?.querySelector<HTMLElement>('[aria-current="true"]');
		if (rail && current) {
			const box = rail.getBoundingClientRect();
			const item = current.getBoundingClientRect();
			if (item.top < box.top) rail.scrollTop -= box.top - item.top + 8;
			else if (item.bottom > box.bottom) rail.scrollTop += item.bottom - box.bottom + 8;
		}
	}

	const article = document.getElementById("article-content");
	const bar = document.getElementById("reading-progress");
	const title = root.querySelector<HTMLElement>("[data-post-title]");
	const headTitle = root.querySelector<HTMLElement>("[data-post-head-title]");
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let frame = 0;

	function onScroll() {
		frame = 0;
		if (article && bar) {
			const rect = article.getBoundingClientRect();
			const span = Math.max(1, article.offsetHeight - innerHeight);
			const pct = Math.min(100, Math.max(0, (-rect.top / span) * 100));
			bar.style.width = `${pct}%`;
			clearTimeout(hideTimer);
			bar.classList.toggle("is-visible", pct > 0);
			if (pct > 0) hideTimer = setTimeout(() => bar.classList.remove("is-visible"), 800);
		}
		if (title && headTitle) {
			headTitle.toggleAttribute("data-shown", title.getBoundingClientRect().bottom < 56);
		}
		if (headings.length) {
			let current = headings[0];
			for (const heading of headings) {
				if (heading.getBoundingClientRect().top <= 120) current = heading;
				else break;
			}
			const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
			setActive((atBottom ? headings[headings.length - 1] : current).id);
		}
	}
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(onScroll);
	};
	addEventListener("scroll", schedule, { passive: true, signal });
	addEventListener("resize", schedule, { passive: true, signal });
	signal.addEventListener("abort", () => {
		cancelAnimationFrame(frame);
		clearTimeout(hideTimer);
	});
	onScroll();

	// ── Comments ──────────────────────────────────────────────────────────
	const list = root.querySelector<HTMLElement>("[data-comments-list]");
	const statusText = root.querySelector<HTMLElement>("[data-comments-status-text]");
	const statusDot = root.querySelector<HTMLElement>("[data-comments-dot]");

	function setStatus(text: string, live: boolean) {
		if (statusText) statusText.textContent = text;
		statusDot?.classList.toggle("bg-emerald-500", live);
		statusDot?.classList.toggle("bg-muted-foreground/60", !live);
	}

	function renderComments() {
		setText("[data-comment-count]", countComments(comments));
		if (!list) return;
		list.replaceChildren();
		if (!comments.length) {
			list.append(el("p", "py-8 text-center text-sm text-muted-foreground", "No comments yet. Start the discussion."));
			return;
		}
		comments.forEach((comment) => list.append(commentNode(comment, 0)));
	}

	async function loadComments() {
		const data = await request<{ comments: BlogComment[] }>(`/comments/${slug}`);
		comments = Array.isArray(data.comments) ? data.comments : [];
		renderComments();
		setStatus("Live", true);
	}

	async function postComment(payload: { name: string; text: string; parentId?: string }) {
		await request(`/comments/${slug}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		writeStorage(NAME_KEY, payload.name);
		await loadComments();
	}

	function replyForm(parentId: string, onDone: () => void): HTMLFormElement {
		const form = el("form", "mt-3 grid gap-2 rounded-lg border border-border/40 bg-muted/30 p-3");
		form.noValidate = true;
		const nameLabel = el("label", "grid gap-1 text-xs font-medium", "Name");
		const name = el("input", "post-input");
		name.name = "name";
		name.autocomplete = "name";
		name.maxLength = 120;
		name.value = readStorage(NAME_KEY) ?? "";
		nameLabel.append(name);
		const textLabel = el("label", "grid gap-1 text-xs font-medium", "Reply");
		const text = el("textarea", "post-input resize-y");
		text.name = "text";
		text.rows = 2;
		text.maxLength = 5000;
		textLabel.append(text);
		const error = el("p", "flex-1 text-xs text-destructive");
		error.setAttribute("role", "alert");
		const cancel = el("button", "rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60", "Cancel");
		cancel.type = "button";
		const submit = el(
			"button",
			"rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
			"Reply",
		);
		submit.type = "submit";
		const actions = el("div", "flex items-center gap-2");
		actions.append(error, cancel, submit);
		form.append(nameLabel, textLabel, actions);

		cancel.addEventListener("click", onDone, { signal });
		form.addEventListener(
			"submit",
			async (event) => {
				event.preventDefault();
				const n = name.value.trim();
				const t = text.value.trim();
				if (!n || !t) {
					error.textContent = !n ? "Add your name." : "Write a reply first.";
					haptic("error");
					(!n ? name : text).focus();
					return;
				}
				submit.disabled = true;
				submit.textContent = "Posting";
				try {
					await postComment({ name: n, text: t, parentId });
					haptic("success");
				} catch (err) {
					if (aborted(err)) return;
					haptic("error");
					error.textContent = "Couldn't post your reply. Try again.";
					submit.disabled = false;
					submit.textContent = "Reply";
				}
			},
			{ signal },
		);
		return form;
	}

	function commentNode(comment: BlogComment, depth: number): HTMLElement {
		const wrap = el("div", depth > 0 ? "ml-3 mt-3 flex flex-col gap-3 border-l-2 border-primary/20 pl-4" : "");
		const card = el(
			"article",
			depth === 0 ? "rounded-xl border border-border/60 bg-card/50 p-5" : "rounded-lg border border-border/50 bg-background/60 p-4",
		);
		card.id = `comment-${comment.id}`;

		const header = el("div", "mb-2 flex items-center justify-between gap-2");
		const time = el("time", "font-mono text-xs text-muted-foreground", commentDate(comment.date));
		time.dateTime = comment.date;
		header.append(el("span", "font-mono text-sm font-semibold", comment.name), time);

		const body = el("p", "mb-3 mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85", comment.text);

		const replyButton = el(
			"button",
			"text-xs font-medium text-muted-foreground transition-colors hover:text-primary",
			"Reply",
		);
		replyButton.type = "button";
		replyButton.dataset.haptic = "light";
		replyButton.setAttribute("aria-expanded", "false");

		let form: HTMLFormElement | null = null;
		const closeForm = () => {
			form?.remove();
			form = null;
			replyButton.setAttribute("aria-expanded", "false");
		};
		replyButton.addEventListener(
			"click",
			() => {
				if (form) return closeForm();
				form = replyForm(comment.id, closeForm);
				card.append(form);
				replyButton.setAttribute("aria-expanded", "true");
				form.querySelector<HTMLInputElement>(form.querySelector<HTMLInputElement>("input")?.value ? "textarea" : "input")?.focus();
			},
			{ signal },
		);

		card.append(header, body, replyButton);
		wrap.append(card);
		comment.replies?.forEach((reply) => wrap.append(commentNode(reply, depth + 1)));
		return wrap;
	}

	renderComments();
	loadComments().catch((err) => {
		if (aborted(err)) return;
		setStatus("Showing comments from the last build. Live comments couldn't load.", false);
	});

	// Main comment form.
	const form = root.querySelector<HTMLFormElement>("[data-comment-form]");
	if (form) {
		const nameInput = form.elements.namedItem("name") as HTMLInputElement | null;
		const textInput = form.elements.namedItem("text") as HTMLTextAreaElement | null;
		const error = form.querySelector<HTMLElement>("[data-comment-error]");
		const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		const submitLabel = form.querySelector<HTMLElement>("[data-comment-submit-label]");
		if (nameInput && !nameInput.value) nameInput.value = readStorage(NAME_KEY) ?? "";

		form.addEventListener(
			"submit",
			async (event) => {
				event.preventDefault();
				if (submit?.disabled) return;
				const name = nameInput?.value.trim() ?? "";
				const text = textInput?.value.trim() ?? "";
				if (error) error.textContent = "";
				if (!name || !text) {
					if (error) error.textContent = !name ? "Add your name." : "Write something first.";
					haptic("error");
					(!name ? nameInput : textInput)?.focus();
					return;
				}
				if (submit) submit.disabled = true;
				if (submitLabel) submitLabel.textContent = "Posting";
				try {
					await postComment({ name, text });
					if (textInput) textInput.value = "";
					haptic("success");
					list?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
				} catch (err) {
					if (aborted(err)) return;
					haptic("error");
					if (error) error.textContent = "Couldn't post your comment. Try again.";
				} finally {
					if (!signal.aborted) {
						if (submit) submit.disabled = false;
						if (submitLabel) submitLabel.textContent = "Post comment";
					}
				}
			},
			{ signal },
		);
	}
}

// Wiring runs last: initPost depends on the helpers above being initialized.
let page: AbortController | undefined;

function boot() {
	const root = document.querySelector<HTMLElement>("[data-blog-post]");
	if (!root || root.dataset.wired === "true") return;
	page?.abort();
	page = new AbortController();
	root.dataset.wired = "true";
	initPost(root, page.signal);
}

document.addEventListener("astro:page-load", boot);
document.addEventListener("astro:before-swap", () => {
	page?.abort();
	page = undefined;
});
boot();
