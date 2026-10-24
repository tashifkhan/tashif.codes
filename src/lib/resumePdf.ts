import { jsPDF } from "jspdf";
import { experiences } from "@/data/experiences";
import { contactEmail, owner } from "@/data/profile";
import {
	education,
	positions,
	resumeProjects,
	skillCategories,
} from "@/data/resume";

/** Lays out the A4 resume from the same data the /resume page renders. */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - MARGIN;

const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [75, 85, 99];
const RULE: [number, number, number] = [209, 213, 219];
const ACCENT: [number, number, number] = [180, 83, 9];

const BODY_SIZE = 9.3;
const BODY_LEADING = 12;

const stripHtml = (html: string) =>
	html
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/₹/g, "Rs ")
		.replace(/\s+/g, " ")
		.trim();

const buildResumePdf = () => {
	const doc = new jsPDF({
		orientation: "portrait",
		unit: "pt",
		format: "a4",
		compress: true,
	});
	doc.setProperties({
		title: "Tashif Ahmad Khan - Resume",
		author: owner.name,
		subject: "Resume",
		creator: "tashif.codes/resume:pdf",
	});

	let y = MARGIN;

	const font = (
		style: "normal" | "bold" | "italic" | "bolditalic",
		size: number,
		color: [number, number, number] = INK,
	) => {
		doc.setFont("helvetica", style);
		doc.setFontSize(size);
		doc.setTextColor(...color);
	};

	const newPage = () => {
		doc.addPage();
		y = MARGIN;
	};

	const ensure = (height: number) => {
		if (y + height > BOTTOM) newPage();
	};

	const section = (label: string) => {
		if (y + 48 > BOTTOM) newPage();
		y += 13;
		font("bold", 9.5, ACCENT);
		doc.setCharSpace(1.1);
		doc.text(label.toUpperCase(), MARGIN, y);
		doc.setCharSpace(0);
		y += 6;
		doc.setDrawColor(...RULE);
		doc.setLineWidth(0.7);
		doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
		y += 13;
	};

	const entry = (
		title: string,
		subtitle: string | null,
		period: string | null,
		keepWith = 30,
	) => {
		ensure(keepWith);
		font("bold", 10, INK);
		doc.text(title, MARGIN, y);

		if (period) {
			font("normal", 8.5, MUTED);
			doc.text(period, PAGE_WIDTH - MARGIN, y, { align: "right" });
		}

		y += 12;

		if (subtitle) {
			font("normal", 8.8, MUTED);
			const lines = doc.splitTextToSize(subtitle, CONTENT_WIDTH) as string[];
			for (const line of lines) {
				ensure(10.5);
				doc.text(line, MARGIN, y);
				y += 10.5;
			}
		}
	};

	const bullets = (points: string[]) => {
		const indent = 11;
		const textWidth = CONTENT_WIDTH - indent;

		for (const point of points) {
			font("normal", BODY_SIZE, INK);
			const lines = doc.splitTextToSize(
				stripHtml(point),
				textWidth,
			) as string[];

			lines.forEach((line, index) => {
				ensure(BODY_LEADING);
				if (index === 0) {
					doc.text("•", MARGIN + 1, y);
				}
				doc.text(line, MARGIN + indent, y);
				y += BODY_LEADING;
			});

			y += 2;
		}
	};

	const links = (items: { label: string; url: string }[]) => {
		if (!items.length) return;
		ensure(12);
		font("normal", 8.3, ACCENT);
		let x = MARGIN;
		items.forEach((item, index) => {
			if (index > 0) {
				doc.setTextColor(...RULE);
				doc.text("·", x, y);
				x += doc.getTextWidth("·") + 6;
			}
			doc.setTextColor(...ACCENT);
			doc.textWithLink(item.label, x, y, { url: item.url });
			x += doc.getTextWidth(item.label) + 6;
		});
		y += 11;
	};

	// Header
	font("bold", 22, INK);
	doc.setCharSpace(0.6);
	doc.text(owner.name.toUpperCase(), MARGIN, y);
	doc.setCharSpace(0);

	y += 8;
	doc.setDrawColor(...ACCENT);
	doc.setLineWidth(2);
	doc.line(MARGIN, y, MARGIN + 52, y);

	y += 15;
	font("normal", 9, MUTED);
	const contacts = [
		{ label: contactEmail, url: `mailto:${contactEmail}` },
		{ label: "GitHub", url: "https://github.com/tashifkhan" },
		{ label: "LinkedIn", url: "https://linkedin.com/in/tashifkhan" },
		{ label: "taf.sh", url: "https://taf.sh" },
	];
	let contactX = MARGIN;
	contacts.forEach((contact, index) => {
		if (index > 0) {
			doc.setTextColor(...RULE);
			doc.text(" / ", contactX, y);
			contactX += doc.getTextWidth(" / ");
		}
		doc.setTextColor(...MUTED);
		doc.textWithLink(contact.label, contactX, y, { url: contact.url });
		contactX += doc.getTextWidth(contact.label);
	});

	y += 13;
	font("normal", 8.8, MUTED);
	doc.text("Full Stack Engineer  ·  Delhi, India", MARGIN, y);

	// Skills
	section("Skills");
	for (const category of skillCategories) {
		ensure(14);
		font("bold", BODY_SIZE, INK);
		const label = `${category.label}:`;
		doc.text(label, MARGIN, y);
		const indent = doc.getTextWidth(label) + 7;

		font("normal", BODY_SIZE, INK);
		const lines = doc.splitTextToSize(
			category.items.join(", "),
			CONTENT_WIDTH - indent,
		) as string[];

		lines.forEach((line, index) => {
			if (index > 0) ensure(BODY_LEADING);
			doc.text(line, MARGIN + indent, y);
			y += BODY_LEADING;
		});
		y += 1.5;
	}

	// Experience
	section("Experience");
	for (const job of experiences) {
		entry(job.company, job.role, job.period, 55);
		bullets(job.points);
		y += 3;
	}

	// Projects
	section("Selected Projects");
	for (const project of resumeProjects) {
		entry(project.title, project.stack, null, 100);
		links(project.links);
		bullets(project.points.slice(0, 3));
		y += 3;
	}

	// Education
	section("Education");
	for (const school of education) {
		entry(school.institute, school.degree ?? null, school.period, 46);
		font("normal", BODY_SIZE, INK);
		const details = school.details.join("  ·  ");
		ensure(BODY_LEADING);
		doc.text(details, MARGIN, y);
		y += BODY_LEADING + 7;
	}

	// Positions of responsibility
	section("Positions of Responsibility");
	for (const position of positions) {
		entry(position.title, position.org, position.period, 38);
		bullets(position.points);
		y += 2;
	}

	return doc.output("arraybuffer");
};

export { buildResumePdf };
