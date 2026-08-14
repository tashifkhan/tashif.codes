/**
 * Generated documentation page and sidebar shapes.
 */

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
