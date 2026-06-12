import { defineMiddleware } from "astro:middleware";

const SHORTENER_ORIGIN = "https://u.tashif.codes";
const SHORTENER_URLS_ENDPOINT = `${SHORTENER_ORIGIN}/api/public/urls`;

type ShortURL = {
	shortlink: string;
	longlink: string;
};

export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();

	// Only fall back for navigations the main site couldn't resolve.
	if (response.status !== 404 || context.request.method !== "GET") {
		return response;
	}

	const shortlink = context.url.pathname.replace(/^\/+|\/+$/g, "");
	if (!shortlink || shortlink.includes("/")) {
		return response;
	}

	try {
		const urlsResponse = await fetch(SHORTENER_URLS_ENDPOINT);
		if (!urlsResponse.ok) {
			return response;
		}

		const urls = (await urlsResponse.json()) as ShortURL[];
		const match = urls.find((url) => url.shortlink === shortlink);
		if (match?.longlink) {
			return context.redirect(match.longlink, 302);
		}
	} catch {
		// Network error -> fall through to the local 404 page.
	}

	// Unknown on both sites -> show tashif.codes' own 404.astro.
	return response;
});
