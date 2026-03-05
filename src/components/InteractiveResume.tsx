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

// --- INTERFACES ---

export interface Experience {
	company: string;
	role: string;
	period: string;
	color: string;
	points: string[];
	certificate?: string;
}

export interface Project {
	title: string;
	stack: string;
	color: string;
	links: { label: string; url: string }[];
	points: string[];
}

export interface Education {
	institute: string;
	period: string;
	degree?: string;
	details: string[];
	color: string;
}

export interface Position {
	title: string;
	org: string;
	period: string;
	color: string;
	points: string[];
}

export interface SkillCategory {
	label: string;
	color: string;
	items: string[];
	// Icon is passed as a component or we map it internally if needed,
	// but for simplicity in props we might just pass the list and handle icons internally
	// or pass lucide icon names. For now, we'll map internally based on label or use a generic one.
}

interface InteractiveResumeProps {
	experiences: Experience[];
	projects: Project[];
	education: Education[];
	positions: Position[];
	skillCategories: SkillCategory[];
}

// --- COMPONENTS ---

const colorMap: Record<string, string> = {
	purple:
		"from-purple-500/10 to-purple-900/10 border-purple-500/20 text-purple-600 dark:text-purple-300 hover:border-purple-500/50",
	blue: "from-blue-500/10 to-blue-900/10 border-blue-500/20 text-blue-600 dark:text-blue-300 hover:border-blue-500/50",
	green:
		"from-emerald-500/10 to-emerald-900/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300 hover:border-emerald-500/50",
	yellow:
		"from-yellow-500/10 to-yellow-900/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-300 hover:border-yellow-500/50",
	orange:
		"from-orange-500/10 to-orange-900/10 border-orange-500/20 text-orange-600 dark:text-orange-300 hover:border-orange-500/50",
	red: "from-red-500/10 to-red-900/10 border-red-500/20 text-red-600 dark:text-red-300 hover:border-red-500/50",
	indigo:
		"from-indigo-500/10 to-indigo-900/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-300 hover:border-indigo-500/50",
	emerald:
		"from-emerald-500/10 to-emerald-900/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300 hover:border-emerald-500/50",
	gray: "from-zinc-500/10 to-zinc-900/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-300 hover:border-zinc-500/50",
};

const GlowCard = ({
	children,
	color = "gray",
	className = "",
	onClick,
}: {
	children: React.ReactNode;
	color?: string;
	className?: string;
	onClick?: () => void;
}) => {
	return (
		<div
			onClick={onClick}
			className={cn(
				`group relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm transition-all duration-500`,
				colorMap[color] || colorMap.gray,
				className,
			)}
		>
			{/* Noise texture overlay */}
			<div
				className="absolute inset-0 bg-white/5 dark:bg-black/5 opacity-10"
				style={{ backgroundImage: "url('data:image/svg+xml,...')" }}
			></div>

			<div className="relative z-10 p-6 h-full flex flex-col">{children}</div>
			{/* Spotlight Effect - Subtle on light, more visible on dark */}
			<div className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100 z-20">
				<div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent dark:from-white/5" />
			</div>
		</div>
	);
};

const SectionHeader = ({
	id,
	title,
	icon: Icon,
}: {
	id: string;
	title: string;
	icon: any;
}) => (
	<div id={id} className="flex items-center gap-3 mb-8 pt-16 scroll-mt-24">
		<div className="p-2 bg-muted border border-border rounded-lg">
			<Icon className="w-5 h-5 text-muted-foreground" />
		</div>
		<h2 className="text-2xl font-bold tracking-tight text-foreground uppercase font-mono">
			{title}
		</h2>
		<div className="h-px flex-1 bg-gradient-to-r from-border to-transparent ml-4"></div>
	</div>
);

const tocMain = [
	{ id: "about", label: "About", icon: Terminal },
	{ id: "skills", label: "Stack", icon: Cpu },
	{ id: "experience", label: "Work", icon: Zap },
	{ id: "projects", label: "Builds", icon: Globe },
	{ id: "education", label: "Edu", icon: BookOpen },
	{ id: "positions", label: "Roles", icon: Layout },
];

export const InteractiveResume: React.FC<InteractiveResumeProps> = ({
	experiences,
	projects,
	education,
	positions,
	skillCategories,
}) => {
	const [activeSection, setActiveSection] = useState("about");
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
		};
		window.addEventListener("scroll", handleScroll);
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

	return (
		<div className="min-h-screen bg-transparent text-foreground font-sans w-full">
			{/* Background Grid - Optional, reusing existing background from Layout usually, but adding local grid if needed */}
			<div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
				<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
			</div>

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
					<main className="flex-1 min-w-0 lg:pr-56">
						{/* About Section - Simplified since main header already shows name/avatar */}
						<section id="about" className="mb-16 pt-8 scroll-mt-24">
							<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted/30 border border-border p-6 md:p-8">
								{/* Background decorative elements */}
								<div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
								<div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

								<div className="relative z-10 space-y-6">
									{/* Intro text */}
									<div className="space-y-4">
										<h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
											Holaaaa! 👋
										</h2>
										<p className="text-base md:text-lg text-muted-foreground leading-relaxed">
											I'm an engineering undergraduate based in{" "}
											<span className="text-foreground font-medium">
												Delhi, India
											</span>
											, working at the intersection of{" "}
											<span className="text-foreground font-medium">
												Full-stack Development
											</span>{" "}
											and{" "}
											<span className="text-foreground font-medium">
												Generative AI
											</span>
											. I’ve always been driven by the idea that software should
											bridge the gap between complex systems and the end-user.
											This philosophy led me to build the{" "}
											<span className="text-foreground font-medium">
												JIIT Tools Suite
											</span>
											. What started as a simple React PWA has now evolved into
											a platform serving{" "}
											<span className="text-foreground font-medium">
												18,000+ daily users
											</span>{" "}
											. In essence I'm an Engineering student by day,{" "}
											<span className="text-foreground font-medium">
												developer and debater
											</span>{" "}
											by night, with a pation to solve real world problems
											(mostly my laziness) via code.
										</p>
									</div>

									{/* Quick highlights */}
									<div className="flex flex-wrap items-center gap-2">
										<Badge
											variant="outline"
											className="gap-1.5 font-mono bg-background/50"
										>
											<MapPin size={12} className="text-primary" />
											Delhi, India
										</Badge>
										<Badge variant="secondary" className="font-mono">
											Full Stack Engineer
										</Badge>
										<Badge variant="secondary" className="font-mono">
											Open Source
										</Badge>
									</div>

									{/* Action Buttons */}
									<div className="flex flex-wrap gap-3 pt-2">
										<Button
											asChild
											onClick={() => trigger("light")}
											className="gap-2 bg-primary hover:bg-primary/90"
										>
											<a
												href="https://github.com/tashifkhan"
												target="_blank"
												rel="noreferrer"
											>
												<Github size={18} />
												<span className="font-semibold">GitHub</span>
											</a>
										</Button>
										<Button asChild variant="outline" onClick={() => trigger("light")} className="gap-2">
											<a
												href="https://linkedin.com/in/tashifkhan"
												target="_blank"
												rel="noreferrer"
											>
												<Linkedin size={18} />
												<span className="font-semibold">LinkedIn</span>
											</a>
										</Button>
										<Button asChild variant="outline" onClick={() => trigger("light")} className="gap-2">
											<a href="mailto:me@tashif.codes">
												<Mail size={18} />
												<span className="font-semibold">Email</span>
											</a>
										</Button>
										<Button asChild variant="outline" onClick={() => trigger("light")} className="gap-2">
											<a
												href="https://drive.tashif.codes/s/wQJtDaSs5kjkY2p"
												target="_blank"
												rel="noreferrer"
											>
												<Download size={18} />
												<span className="font-semibold">Resume</span>
											</a>
										</Button>
									</div>
								</div>
							</div>
						</section>

						{/* Skills (System Specs Style) */}
						<SectionHeader id="skills" title="System Specs" icon={Cpu} />
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-20">
							{skillCategories.map((cat) => {
								// Simple icon mapping since we are passing plain objects
								let Icon = Terminal;
								if (cat.label === "Frameworks") Icon = Layout;
								if (cat.label === "Databases") Icon = Globe; // using Globe for DB as placeholder/requested
								if (cat.label === "Tools") Icon = Zap;
								// Or rely on logic:
								// const Icon = cat.icon || Terminal;

								return (
									<div
										key={cat.label}
										className="p-5 rounded-xl bg-card border border-border hover:border-ring/50 transition-all duration-300 shadow-sm"
									>
										<div className="flex items-center gap-3 mb-4 border-b border-border pb-3">
											<div
												className={cn(
													"p-1.5 rounded-md bg-muted text-muted-foreground",
												)}
											>
												<Icon size={16} />
											</div>
											<h3
												className={cn(
													"text-xs font-bold uppercase tracking-widest text-muted-foreground",
												)}
											>
												{cat.label}
											</h3>
										</div>
										<div className="flex flex-wrap gap-2">
											{cat.items.map((item) => (
												<Badge
													key={item}
													variant="secondary"
													className="font-mono text-xs font-normal"
												>
													{item}
												</Badge>
											))}
										</div>
									</div>
								);
							})}
						</div>

						{/* Experience Timeline Style */}
						<SectionHeader id="experience" title="Experience" icon={Zap} />
						<div className="relative border-l-2 border-border ml-3 md:ml-6 space-y-12 mb-20">
							{experiences.map((exp, idx) => (
								<div key={idx} className="relative pl-8 md:pl-12">
									{/* Node */}
									<div
										className={cn(
											"absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-background border-4 border-muted-foreground/30",
											`border-${exp.color}-500/50`, // Dynamic border color if possible, else standard
										)}
									></div>

									<div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-2">
										<h3 className="text-2xl font-bold text-foreground">
											{exp.role}
										</h3>
										<span className="font-mono text-sm text-muted-foreground">
											{exp.period}
										</span>
									</div>
									<div
										className={cn(
											"text-lg font-medium mb-4",
											`text-${exp.color}-600 dark:text-${exp.color}-400`,
										)}
									>
										{exp.company}
									</div>

									<ul className="space-y-3 mb-4">
										{exp.points.map((pt, i) => (
											<li
												key={i}
												className="text-muted-foreground leading-relaxed text-sm sm:text-base flex items-start gap-3"
											>
												<span className="mt-2 w-1.5 h-1.5 bg-muted-foreground/50 rounded-full shrink-0"></span>
												<span dangerouslySetInnerHTML={{ __html: pt }} />
											</li>
										))}
									</ul>
									{exp.certificate && (
										<a
											href={exp.certificate}
											target="_blank"
											onClick={() => trigger("light")}
											className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors border-b border-transparent hover:border-foreground pb-0.5"
										>
											<Award size={14} /> Certificate
										</a>
									)}
								</div>
							))}
						</div>

						{/* Projects Masonry */}
						<SectionHeader id="projects" title="Selected Works" icon={Globe} />
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
							{projects.map((project, idx) => (
								<GlowCard
									key={idx}
									color={project.color}
									className="flex flex-col h-full shadow-sm"
								>
									<div className="flex justify-between items-start mb-4">
										<div>
											<h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
												{project.title}
											</h3>
											<div
												className="text-xs font-mono text-muted-foreground mt-1 line-clamp-1"
												title={project.stack}
											>
												{project.stack}
											</div>
										</div>
										<div className="flex gap-2">
											{project.links.map((link) => (
												<Button
													key={link.label}
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-muted-foreground hover:text-foreground"
													onClick={() => trigger("light")}
													asChild
												>
													<a
														href={link.url}
														target="_blank"
														aria-label={link.label}
													>
														{link.label === "GitHub" ? (
															<Github size={16} />
														) : (
															<ExternalLink size={16} />
														)}
													</a>
												</Button>
											))}
										</div>
									</div>
									<div className="space-y-3 mt-auto border-t border-border/50 pt-4">
										{project.points.map((pt, i) => (
											<div
												key={i}
												className="flex gap-2 text-sm text-muted-foreground"
											>
												<ChevronRight
													size={14}
													className={cn(
														"shrink-0 mt-1",
														`text-${project.color}-500`,
													)}
												/>
												<span dangerouslySetInnerHTML={{ __html: pt }} />
											</div>
										))}
									</div>
								</GlowCard>
							))}
						</div>

						{/* Education & Positions Grid */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
							<div>
								<SectionHeader
									id="education"
									title="Education"
									icon={BookOpen}
								/>
								<div className="space-y-6">
									{education.map((edu, idx) => (
										<div
											key={idx}
											className="border-l-2 border-border pl-4 py-1 hover:border-primary transition-colors duration-300"
										>
											<div className="text-foreground font-bold">
												{edu.institute}
											</div>
											<div className="text-sm text-muted-foreground font-mono my-1">
												{edu.period}
											</div>
											{edu.degree && (
												<div className="text-sm text-primary">{edu.degree}</div>
											)}
											<div className="flex gap-2 mt-2">
												{edu.details?.map((d) => (
													<Badge
														key={d}
														variant="outline"
														className="text-xs font-normal"
													>
														{d}
													</Badge>
												))}
											</div>
										</div>
									))}
								</div>
							</div>

							<div>
								<SectionHeader
									id="positions"
									title="Leadership"
									icon={Layout}
								/>
								<div className="space-y-4">
									{positions.map((pos, idx) => (
										<div
											key={idx}
											className="group p-4 bg-muted/30 border border-border hover:border-ring/50 rounded-lg transition-all"
										>
											<div className="flex justify-between text-sm mb-1">
												<span className="font-bold text-foreground group-hover:text-primary transition-colors">
													{pos.title}
												</span>
												<span className="text-muted-foreground font-mono text-xs">
													{pos.period}
												</span>
											</div>
											<div className="text-xs text-muted-foreground mb-2">
												{pos.org}
											</div>
											<ul className="space-y-1">
												{pos.points.map((pt, i) => (
													<li
														key={i}
														className="text-xs text-muted-foreground leading-relaxed flex gap-2"
													>
														<span className="text-muted-foreground/60">•</span>{" "}
														{pt}
													</li>
												))}
											</ul>
										</div>
									))}
								</div>
							</div>
						</div>
					</main>

					{/* Right Sidebar - Fixed on page */}
					<aside className="hidden lg:block fixed top-1/2 -translate-y-1/2 right-[max(2rem,calc((100vw-80rem)/2+2rem))] w-48 z-40">
						<div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-4 shadow-xl">
							<div className="flex items-center gap-2 mb-4 px-2">
								<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
								<span className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
									System Nav
								</span>
							</div>
							<nav className="space-y-1">
								{tocMain.map((item) => {
									const isActive = activeSection === item.id;
									const Icon = item.icon;
									return (
										<button
											key={item.id}
											onClick={() => scrollTo(item.id)}
											className={cn(
												"group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300",
												isActive
													? "bg-primary text-primary-foreground font-bold shadow-md"
													: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
											)}
										>
											<Icon
												size={16}
												className={
													isActive
														? "text-primary-foreground"
														: "group-hover:text-accent-foreground"
												}
											/>
											{item.label}
										</button>
									);
								})}
							</nav>

							{/* Decorative Tech Elements */}
							<div className="mt-6 px-2 pt-6 border-t border-border space-y-3">
								<div className="flex justify-between text-[10px] text-muted-foreground font-mono">
									<span>CPU</span>
									<span>12%</span>
								</div>
								<div className="w-full bg-muted h-0.5 rounded-full overflow-hidden">
									<div className="w-[12%] h-full bg-green-500/50"></div>
								</div>
								<div className="flex justify-between text-[10px] text-muted-foreground font-mono">
									<span>RAM</span>
									<span>48%</span>
								</div>
								<div className="w-full bg-muted h-0.5 rounded-full overflow-hidden">
									<div className="w-[48%] h-full bg-purple-500/50"></div>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</div>

			{/* Mobile Menu Overlay */}
			{isMenuOpen && (
				<div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl p-8 flex flex-col justify-center animate-in fade-in duration-200">
				<Button
					variant="ghost"
					size="icon"
					className="absolute top-4 right-4"
					onClick={() => { trigger("light"); setIsMenuOpen(false); }}
				>
					<X size={24} />
				</Button>
					<nav className="space-y-6">
						{tocMain.map((item) => (
							<button
								key={item.id}
								onClick={() => scrollTo(item.id)}
								className="block w-full text-center text-3xl font-black text-foreground uppercase tracking-tight hover:text-primary transition-colors"
							>
								{item.label}
							</button>
						))}
					</nav>
				</div>
			)}
		</div>
	);
};

export default InteractiveResume;
