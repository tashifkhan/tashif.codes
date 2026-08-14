import React, { useState, useEffect } from "react";

import {
	Github,
	Linkedin,
	Mail,
	ExternalLink,
	Award,
	ChevronRight,
	Menu,
	X,
	Terminal,
	Cpu,
	Globe,
	Zap,
	Layout,
	BookOpen,
	MapPin,
	Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWebHaptics } from "web-haptics/react";

import { resumeAbout } from "../../data/resume";
import type {
	Education,
	ExperienceEntry,
	Position,
	ResumeProject,
	SkillCategory,
} from "@/types";

interface InteractiveResumeProps {
	experiences: ExperienceEntry[];
	projects: ResumeProject[];
	education: Education[];
	positions: Position[];
	skillCategories: SkillCategory[];
}

const actionIcons = {
	github: Github,
	linkedin: Linkedin,
	mail: Mail,
	download: Download,
} as const;

// Shared panel shell used across the dashboard (GitHub stats, star lists, …)
const panelClass =
	"rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm";

// --- HELPERS ---

function parsePeriodDuration(period: string): string {
	const monthMap: Record<string, number> = {
		jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
		jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
		january: 1, february: 2, march: 3, april: 4, june: 6,
		july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
	};
	const now = new Date();
	const parts = period.split(/\s*[–-]\s*/);
	if (parts.length < 2) return "";
	const parseDate = (s: string): Date | null => {
		const t = s.trim().toLowerCase();
		if (t === "present" || t === "current") return now;
		const tokens = t.split(/\s+/);
		if (tokens.length >= 2) {
			const month = monthMap[tokens[0]];
			const year = parseInt(tokens[1]);
			if (month && !isNaN(year)) return new Date(year, month - 1);
		}
		return null;
	};
	const start = parseDate(parts[0]);
	const end = parseDate(parts[1]);
	if (!start || !end) return "";
	let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
	if (months < 1) months = 1;
	const years = Math.floor(months / 12);
	const rem = months % 12;
	if (years === 0) return `${months} mo`;
	if (rem === 0) return `${years} yr`;
	return `${years} yr ${rem} mo`;
}

// --- COMPONENTS ---

/** Section heading matching the dashboard pattern: bold title + mono meta + hairline. */
const SectionHeader = ({
	id,
	title,
	meta,
}: {
	id: string;
	title: string;
	meta?: string;
}) => (
	<div id={id} className="flex items-center gap-x-3 min-w-0 mb-6 pt-12 scroll-mt-24">
		<h2 className="font-sans text-lg sm:text-xl font-bold tracking-tight text-foreground shrink-0">
			{title}
		</h2>
		{meta && (
			<span className="font-mono text-xs text-muted-foreground truncate">
				{meta}
			</span>
		)}
		<div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
	</div>
);

/** zsh-style window chrome (traffic lights + label), as used by EmptyState. */
const WindowBar = ({ label, hint }: { label: string; hint?: string }) => (
	<div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-2.5">
		<span className="flex gap-1.5" aria-hidden="true">
			<span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
			<span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
			<span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
		</span>
		<span className="ml-1 font-mono text-[11px] text-muted-foreground/60 truncate">
			{label}
		</span>
		{hint && (
			<span className="ml-auto font-mono text-[10px] text-muted-foreground/50 shrink-0">
				{hint}
			</span>
		)}
	</div>
);

/** Terminal prompt line: ➜ tashif.codes % <command> */
const PromptLine = ({ command }: { command: string }) => (
	<div className="flex items-baseline gap-1.5 font-mono text-sm min-w-0">
		<span className="text-primary font-bold select-none" aria-hidden="true">
			➜
		</span>
		<span className="font-semibold text-foreground">tashif.codes</span>
		<span className="text-muted-foreground/70 select-none" aria-hidden="true">
			%
		</span>
		<span className="text-muted-foreground truncate">{command}</span>
	</div>
);

const CertificateLink = ({
	href,
	onNavigate,
}: {
	href: string;
	onNavigate: () => void;
}) => (
	<a
		href={href}
		target="_blank"
		rel="noopener noreferrer"
		onClick={onNavigate}
		className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
	>
		<Award size={12} className="text-primary/70" />
		certificate
	</a>
);

const tocMain = [
	{ id: "about", label: "about", icon: Terminal },
	{ id: "skills", label: "stack", icon: Cpu },
	{ id: "experience", label: "work", icon: Zap },
	{ id: "projects", label: "builds", icon: Globe },
	{ id: "education", label: "edu", icon: BookOpen },
	{ id: "positions", label: "roles", icon: Layout },
];

export const InteractiveResume: React.FC<InteractiveResumeProps> = ({
	experiences,
	projects,
	education,
	positions,
	skillCategories,
}) => {
	const [activeSection, setActiveSection] = useState("about");
	const [scrollPct, setScrollPct] = useState(0);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const { trigger } = useWebHaptics();

	useEffect(() => {
		const handleScroll = () => {
			const sections = tocMain.map((s) => s.id);
			let current = "about";
			for (const section of sections) {
				const element = document.getElementById(section);
				if (element && window.scrollY >= element.offsetTop - 300) {
					current = section;
				}
			}
			setActiveSection(current);

			const max =
				document.documentElement.scrollHeight - window.innerHeight;
			setScrollPct(
				max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0,
			);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const scrollTo = (id: string) => {
		trigger("selection");
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: "smooth" });
			setIsMenuOpen(false);
		}
	};

	// Group consecutive roles at the same company into one timeline entry
	const companyOrder: string[] = [];
	const companyGroups: Record<string, ExperienceEntry[]> = {};
	experiences.forEach((exp) => {
		if (!companyGroups[exp.company]) {
			companyGroups[exp.company] = [];
			companyOrder.push(exp.company);
		}
		companyGroups[exp.company].push(exp);
	});

	const totalSkills = skillCategories.reduce((n, c) => n + c.items.length, 0);

	const CompanyHeading = ({ exp }: { exp: ExperienceEntry }) => (
		<div className="flex items-center gap-2 mb-3">
			{exp.logo && (
				<img
					src={exp.logo}
					alt=""
					width={18}
					height={18}
					className="w-[18px] h-[18px] rounded-sm object-contain shrink-0"
					onError={(e) => { e.currentTarget.style.display = "none"; }}
				/>
			)}
			{exp.website ? (
				<a
					href={exp.website}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() => trigger("light")}
					className="group/company inline-flex items-center gap-1.5 text-base font-semibold text-foreground transition-colors hover:text-primary"
				>
					{exp.company}
					<ExternalLink
						size={12}
						className="text-muted-foreground opacity-60 transition-colors group-hover/company:text-primary"
					/>
				</a>
			) : (
				<span className="text-base font-semibold text-foreground">
					{exp.company}
				</span>
			)}
		</div>
	);

	const RoleHeading = ({ exp }: { exp: ExperienceEntry }) => (
		<div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-3">
			<h3 className="text-lg font-bold tracking-tight text-foreground">
				{exp.role}
			</h3>
			<span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
				{exp.period}
				{parsePeriodDuration(exp.period) && (
					<span className="opacity-60"> · {parsePeriodDuration(exp.period)}</span>
				)}
			</span>
		</div>
	);

	const BulletList = ({ points }: { points: string[] }) => (
		<ul className="space-y-2.5 mb-4">
			{points.map((pt, i) => (
				<li
					key={i}
					className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"
				>
					<span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
					<span dangerouslySetInnerHTML={{ __html: pt }} />
				</li>
			))}
		</ul>
	);

	return (
		<div className="min-h-screen bg-transparent text-foreground font-sans w-full">
			{/* Mobile Nav */}
			<div className="fixed top-20 right-4 z-50 lg:hidden">
				<Button
					variant="outline"
					size="icon"
					onClick={() => {
						trigger(isMenuOpen ? "light" : "medium");
						setIsMenuOpen(!isMenuOpen);
					}}
					className="rounded-full shadow-xl bg-background/80 backdrop-blur-md"
				>
					{isMenuOpen ? <X size={20} /> : <Menu size={20} />}
				</Button>
			</div>

			{/* Main Layout - Use max-w-7xl like rest of site */}
			<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
					{/* Left Content Column */}
					<main className="flex-1 min-w-0 lg:pr-56 pb-20">
						{/* About - terminal window, matching the welcome statusline & EmptyState */}
						<section id="about" className="pt-6 scroll-mt-24">
							<div className={cn(panelClass, "overflow-hidden")}>
								<WindowBar label="taf@tashif.codes — about" hint="zsh" />
								<div className="p-5 sm:p-6 space-y-5">
									<PromptLine command="cat ./about.md" />

									<div className="space-y-3">
										<h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
											{resumeAbout.greeting}
										</h2>
										<p
											className="text-sm sm:text-base text-muted-foreground leading-relaxed"
											dangerouslySetInnerHTML={{
												__html: resumeAbout.introHtml,
											}}
										/>
									</div>

									{/* Quick highlights */}
									<div className="flex flex-wrap items-center gap-2">
										<span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
											<MapPin size={12} className="text-primary/70" />
											{resumeAbout.location}
										</span>
										{resumeAbout.highlights.map((highlight) => (
											<span
												key={highlight}
												className="inline-flex items-center rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
											>
												{highlight}
											</span>
										))}
									</div>

									{/* Action Buttons */}
									<div className="flex flex-wrap gap-2.5 pt-1">
										{resumeAbout.actions.map((action) => {
											const Icon = actionIcons[action.icon];
											return (
												<Button
													key={action.label}
													asChild
													size="sm"
													variant={action.primary ? "default" : "outline"}
													onClick={() => trigger("light")}
													className={cn(
														"gap-2 rounded-lg",
														action.primary
															? "bg-primary hover:bg-primary/90"
															: "bg-transparent border-border/60 hover:bg-muted/50",
													)}
												>
													<a
														href={action.url}
														{...(action.url.startsWith("mailto:")
															? {}
															: { target: "_blank", rel: "noreferrer" })}
													>
														<Icon size={15} />
														<span className="font-semibold">{action.label}</span>
													</a>
												</Button>
											);
										})}
									</div>
								</div>
							</div>
						</section>

						{/* Stack */}
						<SectionHeader
							id="skills"
							title="Stack"
							meta={`${totalSkills} tools · ${skillCategories.length} categories`}
						/>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{skillCategories.map((cat) => {
								let Icon = Terminal;
								if (cat.label === "Frameworks") Icon = Layout;
								if (cat.label === "Databases") Icon = Globe;
								if (cat.label === "Tools") Icon = Zap;

								return (
									<section
										key={cat.label}
										className={cn(
											panelClass,
											"overflow-hidden transition-colors hover:border-primary/30",
										)}
									>
										<div className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
											<Icon className="w-3.5 h-3.5 text-muted-foreground" />
											<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
												{cat.label}
											</span>
											<span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/60">
												{cat.items.length}
											</span>
										</div>
										<div className="p-4 flex flex-wrap gap-1.5">
											{cat.items.map((item) => (
												<Badge
													key={item}
													variant="secondary"
													className="font-mono text-xs font-normal bg-secondary/50 hover:bg-secondary/70 transition-colors border-transparent"
												>
													{item}
												</Badge>
											))}
										</div>
									</section>
								);
							})}
						</div>

						{/* Experience Timeline */}
						<SectionHeader
							id="experience"
							title="Experience"
							meta={`${companyOrder.length} companies · ${experiences.length} roles`}
						/>
						<div className="relative border-l border-border/60 ml-2 md:ml-4 space-y-12">
							{companyOrder.map((company) => {
								const exps = companyGroups[company];
								const first = exps[0];
								const isGrouped = exps.length > 1;

								return (
									<div key={company} className="relative pl-8 md:pl-10">
										{/* Timeline node */}
										<span className="absolute -left-[7px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background border border-border/60">
											<span className="h-1.5 w-1.5 rounded-full bg-primary" />
										</span>

										{/* Company name always at top */}
										<CompanyHeading exp={first} />

										{isGrouped ? (
											/* ── Grouped: inner role timeline ── */
											<div className="relative border-l border-border/40 space-y-8 pl-6">
												{exps.map((exp, i) => (
													<div key={i} className="relative">
														<span className="absolute -left-[29px] top-[7px] h-2.5 w-2.5 rounded-full bg-background border border-primary/50" />
														<RoleHeading exp={exp} />
														<BulletList points={exp.points} />
														{exp.certificate && (
															<CertificateLink
																href={exp.certificate}
																onNavigate={() => trigger("light")}
															/>
														)}
													</div>
												))}
											</div>
										) : (
											/* ── Single role ── */
											<>
												<RoleHeading exp={first} />
												<BulletList points={first.points} />
												{first.certificate && (
													<CertificateLink
														href={first.certificate}
														onNavigate={() => trigger("light")}
													/>
												)}
											</>
										)}
									</div>
								);
							})}
						</div>

						{/* Selected Works */}
						<SectionHeader
							id="projects"
							title="Selected Works"
							meta={`${projects.length} builds`}
						/>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
							{projects.map((project, idx) => (
								<section
									key={idx}
									className={cn(
										panelClass,
										"group flex flex-col overflow-hidden transition-colors hover:border-primary/30",
									)}
								>
									<div className="px-5 py-4 border-b border-border/60 flex items-start justify-between gap-3">
										<div className="min-w-0">
											<h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
												{project.title}
											</h3>
											<p
												className="mt-1 font-mono text-[11px] text-muted-foreground truncate"
												title={project.stack}
											>
												{project.stack}
											</p>
										</div>
										<div className="flex gap-1 shrink-0">
											{project.links.map((link) => (
												<Button
													key={link.label}
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground hover:text-foreground"
													onClick={() => trigger("light")}
													asChild
												>
													<a
														href={link.url}
														target="_blank"
														rel="noopener noreferrer"
														aria-label={link.label}
													>
														{link.label === "GitHub" ? (
															<Github size={15} />
														) : (
															<ExternalLink size={15} />
														)}
													</a>
												</Button>
											))}
										</div>
									</div>
									<div className="p-5 pt-4 space-y-2.5 flex-1">
										{project.points.map((pt, i) => (
											<div
												key={i}
												className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
											>
												<ChevronRight
													size={14}
													className="mt-1 shrink-0 text-primary/50"
												/>
												<span dangerouslySetInnerHTML={{ __html: pt }} />
											</div>
										))}
									</div>
								</section>
							))}
						</div>

						{/* Education & Positions Grid */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
							<div>
								<SectionHeader id="education" title="Education" />
								<div className="space-y-4">
									{education.map((edu, idx) => (
										<div
											key={idx}
											className={cn(
												panelClass,
												"relative p-4 transition-colors hover:border-primary/30",
											)}
										>
											<span className="absolute left-0 top-3.5 bottom-3.5 w-[2px] rounded-r-full bg-primary/70" />
											<div className="pl-3">
												<p className="text-sm font-semibold text-foreground">
													{edu.institute}
												</p>
												<p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
													{edu.period}
												</p>
												{edu.degree && (
													<p className="mt-1 text-xs text-primary">
														{edu.degree}
													</p>
												)}
												{edu.details?.length > 0 && (
													<div className="mt-2 flex flex-wrap gap-1.5">
														{edu.details.map((d) => (
															<Badge
																key={d}
																variant="outline"
																className="font-mono text-[10px] font-normal border-border/60"
															>
																{d}
															</Badge>
														))}
													</div>
												)}
											</div>
										</div>
									))}
								</div>
							</div>

							<div>
								<SectionHeader id="positions" title="Leadership" />
								<div className={cn(panelClass, "overflow-hidden")}>
									<div className="divide-y divide-border/40">
										{positions.map((pos, idx) => (
											<div
												key={idx}
												className="group px-5 py-4 hover:bg-muted/30 transition-colors"
											>
												<div className="flex items-baseline justify-between gap-2">
													<p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
														{pos.title}
													</p>
													<span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
														{pos.period}
													</span>
												</div>
												<p className="mt-0.5 font-mono text-[11px] text-muted-foreground/80">
													{pos.org}
												</p>
												<ul className="mt-2 space-y-1.5">
													{pos.points.map((pt, i) => (
														<li
															key={i}
															className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground"
														>
															<span className="mt-[6px] h-1 w-1 rounded-full bg-primary/40 shrink-0" />
															{pt}
														</li>
													))}
												</ul>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</main>

					{/* Right Sidebar - Fixed on page */}
					<aside className="hidden lg:block fixed top-1/2 -translate-y-1/2 right-[max(2rem,calc((100vw-80rem)/2+2rem))] w-48 z-40">
						<div
							className={cn(panelClass, "overflow-hidden shadow-lg bg-card/80")}
						>
							<div className="px-4 py-2.5 border-b border-border/60 bg-muted/40 flex items-center gap-2">
								<span className="flex gap-1.5" aria-hidden="true">
									<span className="h-2 w-2 rounded-full bg-rose-400/70" />
									<span className="h-2 w-2 rounded-full bg-amber-400/70" />
									<span className="h-2 w-2 rounded-full bg-emerald-400/70" />
								</span>
								<span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
									nav
								</span>
							</div>
							<nav className="p-2 space-y-0.5">
								{tocMain.map((item) => {
									const isActive = activeSection === item.id;
									const Icon = item.icon;
									return (
										<button
											key={item.id}
											onClick={() => scrollTo(item.id)}
											className={cn(
												"relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-mono text-xs transition-colors",
												isActive
													? "bg-primary/10 text-primary font-semibold"
													: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
											)}
										>
											{isActive && (
												<span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-primary" />
											)}
											<Icon size={14} className="shrink-0" />
											./{item.label}
										</button>
									);
								})}
							</nav>

							{/* Scroll progress readout */}
							<div className="px-4 py-3 border-t border-border/60 space-y-1.5">
								<div className="flex justify-between font-mono text-[10px] text-muted-foreground">
									<span>scroll</span>
									<span className="tabular-nums">{scrollPct}%</span>
								</div>
								<div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
									<div
										className="h-full rounded-full bg-primary/70 transition-[width] duration-150"
										style={{ width: `${scrollPct}%` }}
									/>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</div>

			{/* Mobile Menu Overlay */}
			{isMenuOpen && (
				<div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl p-8 flex flex-col justify-center animate-in fade-in duration-200 lg:hidden">
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-4 right-4"
						onClick={() => { trigger("light"); setIsMenuOpen(false); }}
					>
						<X size={24} />
					</Button>
					<nav className="mx-auto w-full max-w-xs space-y-1">
						{tocMain.map((item) => {
							const isActive = activeSection === item.id;
							const Icon = item.icon;
							return (
								<button
									key={item.id}
									onClick={() => scrollTo(item.id)}
									className={cn(
										"w-full flex items-center gap-3 rounded-lg px-4 py-3 font-mono text-base transition-colors",
										isActive
											? "bg-primary/10 text-primary font-semibold"
											: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
									)}
								>
									<Icon size={16} className="shrink-0" />
									./{item.label}
								</button>
							);
						})}
					</nav>
				</div>
			)}
		</div>
	);
};

export default InteractiveResume;
