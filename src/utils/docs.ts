import fs from 'fs';
import path from 'path';
import { formatTitle } from './formatTitle';

const DOCS_DIR = path.join(process.cwd(), 'src/data/docs');

// Helper to resolve project directory case-insensitively
function resolveProjectDir(projectSlug: string): string | null {
  if (!fs.existsSync(DOCS_DIR)) return null;
  const entries = fs.readdirSync(DOCS_DIR);
  if (entries.includes(projectSlug)) return projectSlug;
  const match = entries.find(e => e.toLowerCase() === projectSlug.toLowerCase());
  return match || null;
}

export interface DocPage {
  params: {
    project: string;
    slug: string | undefined;
  };
  props: {
    project: string;
    slug: string;
    content: string;
    title: string;
    headings: { depth: number; text: string; slug: string }[];
  };
}

export interface SidebarItem {
  title: string;
  slug: string;
  path: string;
  order: number;
  children?: SidebarItem[];
  depth: number;
}

// Helper to slugify text (matching MarkdownRenderer.astro)
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Helper to extract h2 and h3 headings from markdown
function extractHeadings(content: string): { depth: number; text: string; slug: string }[] {
  const headings: { depth: number; text: string; slug: string }[] = [];
  const lines = content.split('\n');
  
  // Basic regex to match lines starting with ## or ###
  // Also handle headings that might have a number prefix like "## 1. Introduction"
  const headingRegex = /^(#{2,3})\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      const depth = match[1].length;
      const text = match[2].trim().replace(/\{#.*\}$/, ''); // Remove any custom IDs like {#my-id}
      headings.push({
        depth,
        text,
        slug: slugify(text)
      });
    }
  }
  return headings;
}

// Helper to get all projects (directories in src/data/docs)
export function getProjects(): string[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs.readdirSync(DOCS_DIR).filter(file => {
    return fs.statSync(path.join(DOCS_DIR, file)).isDirectory() && file !== 'images';
  });
}

// Recursive function to get all markdown files
function getMarkdownFiles(dir: string, baseDir: string = ''): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = path.join(baseDir, file);
    
    if (stat && stat.isDirectory()) {
       results = results.concat(getMarkdownFiles(filePath, relativePath));
    } else if (file.endsWith('.md')) {
      results.push(relativePath);
    }
  }
  return results;
}

export function getAllDocs(): DocPage[] {
  const projects = getProjects();
  const pages: DocPage[] = [];

  for (const project of projects) {
    const projectDir = path.join(DOCS_DIR, project);
    const files = getMarkdownFiles(projectDir);

    for (const file of files) {
      const content = fs.readFileSync(path.join(projectDir, file), 'utf-8');
      const slug = file.replace(/\.md$/, '');
      const title = formatTitle(path.basename(slug));
      const headings = extractHeadings(content);

      pages.push({
        params: {
          project: project.toLowerCase(),
          slug, 
        },
        props: {
          project,
          slug,
          content,
          title,
          headings,
        }
      });
    }
  }
  return pages;
}

// ============================================================
// SIDEBAR BUILDING
// ============================================================

// Detect if a project uses numbered prefix naming (e.g., "1-overview.md", "3.1-title.md")
function usesNumberedPrefixes(projectDir: string): boolean {
  const entries = fs.readdirSync(projectDir);
  const mdFiles = entries.filter(e => e.endsWith('.md'));
  if (mdFiles.length === 0) return false;
  
  // If more than half the top-level .md files start with a number, it's numbered
  const numbered = mdFiles.filter(f => /^\d+/.test(f));
  return numbered.length > mdFiles.length / 2;
}

// ---- NUMBERED PREFIX APPROACH (existing logic for jportal, etc.) ----

function parseOrder(filename: string): number[] {
  const match = filename.match(/^(\d+(\.\d+)*)/);
  if (!match) return [999];
  return match[0].split('.').map(Number);
}

function compareOrders(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const valA = a[i] ?? -1;
    const valB = b[i] ?? -1;
    if (valA !== valB) {
      if (valA === -1) return -1;
      if (valB === -1) return 1;
      return valA - valB;
    }
  }
  return 0;
}

function buildNumberedSidebar(projectSlug: string, projectDir: string): SidebarItem[] {
  const files = getMarkdownFiles(projectDir);
  
  interface Node extends SidebarItem {
    orderPath: number[];
  }
  
  const nodes: Node[] = files.map(file => {
    const filename = path.basename(file, '.md');
    const orderPath = parseOrder(filename);
    const title = formatTitle(filename.replace(/^(\d+(\.\d+)*)-?/, ''));

    return {
      title: title || formatTitle(filename),
      slug: `${projectSlug.toLowerCase()}/${file.replace(/\.md$/, '')}`,
      path: file,
      order: orderPath[0],
      orderPath: orderPath,
      children: [],
      depth: orderPath.length - 1
    };
  });

  nodes.sort((a, b) => compareOrders(a.orderPath, b.orderPath));

  const root: SidebarItem[] = [];
  const stack: Node[] = [];

  for (const node of nodes) {
    if (stack.length === 0) {
      root.push(node);
      stack.push(node);
      continue;
    }

    while (stack.length > 0) {
      const parent = stack[stack.length - 1];
      const isPrefix = parent.orderPath.every((val, i) => val === node.orderPath[i]);
      const isDirectChild = isPrefix && node.orderPath.length === parent.orderPath.length + 1;
      
      if (isDirectChild) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        stack.push(node); 
        break;
      } else {
        stack.pop();
        if (stack.length === 0) {
          root.push(node);
          stack.push(node);
          break;
        }
      }
    }
  }

  return root;
}

// ---- FOLDER-BASED APPROACH (for talentsync and similar) ----

// Predefined section order for folder-based projects.
// Items not listed here will be appended at the end in filesystem order.
const SECTION_ORDER: Record<string, string[]> = {
  talentsync: [
    'Getting Started',
    'Project Overview',
    'Architecture Overview',
    'Backend API Reference',
    'Feature Implementation',
    'Frontend Application',
    'AI_ML Integration',
    'Database Design',
    'Authentication & Authorization',
    'Deployment & DevOps',
    'API Client Libraries',
    'Testing Strategy',
    'Troubleshooting & FAQ',
  ],
};

function sortByDefinedOrder(items: SidebarItem[], projectSlug: string): SidebarItem[] {
  const order = SECTION_ORDER[projectSlug.toLowerCase()];
  if (!order) return items; // no predefined order, keep filesystem order

  return [...items].sort((a, b) => {
    const aIdx = order.findIndex(name => name.toLowerCase() === a.title.toLowerCase());
    const bIdx = order.findIndex(name => name.toLowerCase() === b.title.toLowerCase());
    // Items in the order list come first; unlisted items go to the end
    const aPos = aIdx === -1 ? order.length + items.indexOf(a) : aIdx;
    const bPos = bIdx === -1 ? order.length + items.indexOf(b) : bIdx;
    return aPos - bPos;
  });
}

function buildFolderSidebar(projectSlug: string, projectDir: string): SidebarItem[] {
  const normalizedSlug = projectSlug.toLowerCase();

  function buildTreeFromDir(dir: string, depth: number): SidebarItem[] {
    const entries = fs.readdirSync(dir);
    const items: SidebarItem[] = [];
    
    // Separate files and directories
    const mdFiles: string[] = [];
    const subDirs: string[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && entry !== 'images') {
        subDirs.push(entry);
      } else if (entry.endsWith('.md')) {
        mdFiles.push(entry);
      }
    }

    // Determine the parent directory name for matching "index" files
    const dirName = path.basename(dir);

    // Process subdirectories first (they become section groups)
    for (const subDir of subDirs) {
      const subDirPath = path.join(dir, subDir);
      const children = buildTreeFromDir(subDirPath, depth + 1);
      
      // Look for an "index" file in the subdirectory:
      // A file whose name matches the directory name (e.g., "Architecture Overview/Architecture Overview.md")
      const subDirEntries = fs.readdirSync(subDirPath).filter(f => f.endsWith('.md'));
      const indexFileName = subDirEntries.find(f => {
        const baseName = f.replace(/\.md$/, '');
        return baseName.toLowerCase() === subDir.toLowerCase();
      });
      
      if (indexFileName) {
        // The index file becomes the section header link
        const relativePath = path.relative(projectDir, path.join(subDirPath, indexFileName));
        const slug = relativePath.replace(/\.md$/, '');
        
        // Filter out the index file from children (it's now the parent link)
        const filteredChildren = children.filter(c => {
          const childBasename = path.basename(c.path, '.md');
          return childBasename.toLowerCase() !== subDir.toLowerCase();
        });

        items.push({
          title: formatTitle(subDir),
          slug: `${normalizedSlug}/${slug}`,
          path: relativePath,
          order: 0,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
          depth,
        });
      } else {
        // No index file found - create a non-linkable section header
        // Use the first child's slug as a fallback, or '#'
        const firstChild = children[0];
        items.push({
          title: formatTitle(subDir),
          slug: firstChild ? firstChild.slug : '#',
          path: subDir,
          order: 0,
          children: children.length > 0 ? children : undefined,
          depth,
        });
      }
    }

    // Process standalone .md files (not the index file for this directory)
    for (const file of mdFiles) {
      const baseName = file.replace(/\.md$/, '');
      
      // Skip the index file if we're in a subdirectory (it was already used as the section header)
      if (depth > 0 && baseName.toLowerCase() === dirName.toLowerCase()) {
        continue;
      }
      
      const relativePath = path.relative(projectDir, path.join(dir, file));
      const slug = relativePath.replace(/\.md$/, '');

      items.push({
        title: formatTitle(baseName),
        slug: `${normalizedSlug}/${slug}`,
        path: relativePath,
        order: 0,
        depth,
      });
    }

    return items;
  }

  const items = buildTreeFromDir(projectDir, 0);
  // Apply predefined section ordering at the top level
  return sortByDefinedOrder(items, normalizedSlug);
}

// ---- PINNED TOP SECTIONS ----

// Titles that should always appear first and second in the sidebar, in this order.
// Matching is case-insensitive and exact.
const PINNED_OVERVIEW_KEYWORDS = ['project overview', 'overview', 'home'];
const PINNED_GETTING_STARTED_KEYWORDS = ['getting started', 'introduction'];

function pinTopSections(items: SidebarItem[]): SidebarItem[] {
  let overviewItem: SidebarItem | undefined;
  let gettingStartedItem: SidebarItem | undefined;
  const rest: SidebarItem[] = [];

  for (const item of items) {
    const t = item.title.toLowerCase().trim();
    if (!overviewItem && PINNED_OVERVIEW_KEYWORDS.includes(t)) {
      overviewItem = item;
    } else if (!gettingStartedItem && PINNED_GETTING_STARTED_KEYWORDS.includes(t)) {
      gettingStartedItem = item;
    } else {
      rest.push(item);
    }
  }

  const pinned: SidebarItem[] = [];
  if (overviewItem) pinned.push(overviewItem);
  if (gettingStartedItem) pinned.push(gettingStartedItem);
  return [...pinned, ...rest];
}

// ---- UNIFIED getSidebar ----

export function getSidebar(projectSlug: string): SidebarItem[] {
  const realProjectDirName = resolveProjectDir(projectSlug);
  if (!realProjectDirName) return [];

  const projectDir = path.join(DOCS_DIR, realProjectDirName);
  if (!fs.existsSync(projectDir)) return [];

  // Detect structure type and dispatch
  let sidebar: SidebarItem[];
  if (usesNumberedPrefixes(projectDir)) {
    sidebar = buildNumberedSidebar(projectSlug, projectDir);
  } else {
    sidebar = buildFolderSidebar(projectSlug, projectDir);
  }

  // Always float "Project Overview" and "Getting Started" to the top
  return pinTopSections(sidebar);
}

export function getProjectEntry(project: string): string | null {
  const sidebar = getSidebar(project);
  if (sidebar.length === 0) return null;
  
  function findFirstLeaf(items: SidebarItem[]): string | null {
    for (const item of items) {
      if (item.slug !== '#') return item.slug;
      if (item.children) {
        const childSlug = findFirstLeaf(item.children);
        if (childSlug) return childSlug;
      }
    }
    return null;
  }
  
  return findFirstLeaf(sidebar);
}

export function getDocPagination(project: string, currentSlug: string): { prev: SidebarItem | null, next: SidebarItem | null } {
  const sidebar = getSidebar(project);
  
  const flat: SidebarItem[] = [];
  function traverse(items: SidebarItem[]) {
    for (const item of items) {
      if (item.slug !== '#') flat.push(item);
      if (item.children) traverse(item.children);
    }
  }
  traverse(sidebar);
  
  const currentIndex = flat.findIndex(item => {
    const fullFn = `${project.toLowerCase()}/${currentSlug}`;
    return item.slug === fullFn;
  });
  
  if (currentIndex === -1) return { prev: null, next: null };
  
  return {
    prev: currentIndex > 0 ? flat[currentIndex - 1] : null,
    next: currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null
  };
}
