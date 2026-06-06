import { defineMiddleware } from "astro:middleware";

const SHORTENER_ORIGIN = "https://u.tashif.codes";

export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();

	// Only fall back for navigations the main site couldn't resolve.
	if (response.status !== 404 || context.request.method !== "GET") {
		return response;
	}

	const target = SHORTENER_ORIGIN + context.url.pathname + context.url.search;

	try {
		// Ask the shortener whether this code exists, without following its redirect.
		// Must be GET: the shortener only answers GET (it returns 404 to HEAD), and
		// `redirect: "manual"` keeps us from downloading the final destination.
		const probe = await fetch(target, { method: "GET", redirect: "manual" });
		if (probe.status !== 404) {
			// Short code exists (3xx/200) -> hand off to u.tashif.codes, which does
			// the final redirect to the destination.
			return context.redirect(target, 302);
		}
	} catch {
		// Network error -> fall through to the local 404 page.
	}

	// Unknown on both sites -> show tashif.codes' own 404.astro.
	return response;
});
