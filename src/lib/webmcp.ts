export type WebmcpTool = {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations?: {
		readOnlyHint?: boolean;
		untrustedContentHint?: boolean;
		consequentialHint?: boolean;
	};
	execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type ModelContext = {
	registerTool: (
		tool: {
			name: string;
			description: string;
			inputSchema: Record<string, unknown>;
			annotations?: WebmcpTool["annotations"];
			execute: (
				input: Record<string, unknown>,
				options?: { signal?: AbortSignal },
			) => unknown | Promise<unknown>;
		},
		options?: { signal?: AbortSignal },
	) => Promise<unknown>;
};

declare global {
	interface Document {
		modelContext?: ModelContext;
	}
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (value: string) => EMAIL_RE.test(value);

export function clip(value: string, max = 280) {
	const text = value.trim();
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1)}…`;
}

export function stripHtml(html: string) {
	return html
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

export function buildMailto(to: string, subject: string, body: string) {
	return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openMailto(url: string) {
	try {
		const link = document.createElement("a");
		link.href = url;
		link.rel = "noopener";
		document.body.appendChild(link);
		link.click();
		link.remove();
		return true;
	} catch {
		try {
			window.location.href = url;
			return true;
		} catch {
			return false;
		}
	}
}

export async function copyText(value: string) {
	try {
		await navigator.clipboard.writeText(value);
		return true;
	} catch {
		return false;
	}
}

export function contactDraft(input: {
	to: string;
	subject: string;
	body: string;
	opened: boolean;
	filledForm: boolean;
	copied?: boolean;
}) {
	return {
		ok: true,
		sent: false,
		to: input.to,
		subject: input.subject,
		body: input.body,
		mailto: buildMailto(input.to, input.subject, input.body),
		attemptedMailApp: input.opened,
		filledOnPageForm: input.filledForm,
		copied: input.copied ?? false,
		note: input.opened
			? "Tried to open the visitor's mail app with this draft. Whether a handler actually appeared is unknown. It is not sent until they hit Send. If you are an in-chat agent, show this draft and offer to send it from the user's account."
			: "Could not start a mailto: launch. Show this draft in chat and send it from the user's mailbox if they confirm.",
	};
}

export async function registerTools(tools: WebmcpTool[], signal: AbortSignal) {
	const context = document.modelContext;
	if (!context) return false;
	for (const tool of tools) {
		if (signal.aborted) return false;
		await context.registerTool(
			{
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: tool.annotations,
				execute: (input) => tool.execute(input ?? {}),
			},
			{ signal },
		);
	}
	return true;
}
