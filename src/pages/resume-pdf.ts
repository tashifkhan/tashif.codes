import type { APIRoute } from "astro";
import { buildResumePdf } from "@/lib/resumePdf";

export const prerender = true;

/**
 * Built at deploy time from src/data. Vercel rewrites /resume:pdf here, so
 * that colon URL is the only public resume download and no PDF is checked in.
 */
export const GET: APIRoute = () => {
	const pdf = buildResumePdf();

	return new Response(pdf, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition":
				'attachment; filename="Tashif-Ahmad-Khan-Resume.pdf"',
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
};
