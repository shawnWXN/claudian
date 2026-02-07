import { NavigationSidebar } from '@/features/chat/ui/NavigationSidebar';

// Mock obsidian
jest.mock('obsidian', () => ({
  setIcon: jest.fn((el: any, iconName: string) => {
    el.setAttribute('data-icon', iconName);
  }),
}));

type Listener = (event: any) => void;

class MockClassList {
  private classes = new Set<string>();

  add(...items: string[]): void {
    items.forEach((item) => this.classes.add(item));
  }

  remove(...items: string[]): void {
    items.forEach((item) => this.classes.delete(item));
  }

  contains(item: string): boolean {
    return this.classes.has(item);
  }

  toggle(item: string, force?: boolean): void {
    if (force === undefined) {
      if (this.classes.has(item)) {
        this.classes.delete(item);
      } else {
        this.classes.add(item);
      }
      return;
    }
    if (force) {
      this.classes.add(item);
    } else {
      this.classes.delete(item);
    }
  }

  clear(): void {
    this.classes.clear();
  }

  toArray(): string[] {
    return Array.from(this.classes);
  }
}

class MockElement {
  tagName: string;
  classList = new MockClassList();
  style: Record<string, string> = {};
  children: MockElement[] = [];
  attributes: Record<string, string> = {};
  dataset: Record<string, string> = {};
  parent: MockElement | null = null;
  textContent = '';
  private _scrollTop = 0;
  private _scrollHeight = 500;
  private _clientHeight = 500;
  private listeners: Record<string, Listener[]> = {};
  public scrollToCalls: Array<{ top: number; behavior: string }> = [];

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  set className(value: string) {
    this.classList.clear();
    value.split(/\s+/).filter(Boolean).forEach((cls) => this.classList.add(cls));
  }

  get className(): string {
    return this.classList.toArray().join(' ');
  }

  get scrollHeight(): number {
    return this._scrollHeight;
  }

  set scrollHeight(value: number) {
    this._scrollHeight = value;
  }

  get clientHeight(): number {
    return this._clientHeight;
  }

  set clientHeight(value: number) {
    this._clientHeight = value;
  }

  get scrollTop(): number {
    return this._scrollTop;
  }

  set scrollTop(value: number) {
    this._scrollTop = value;
  }

  scrollTo(options: { top: number; behavior: string }): void {
    this.scrollToCalls.push(options);
    this._scrollTop = options.top;
  }

  appendChild(child: MockElement): MockElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  addEventListener(type: string, listener: Listener, _options?: any): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event: any): void {
    const listeners = this.listeners[event.type] || [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  click(): void {
    this.dispatchEvent({ type: 'click', stopPropagation: jest.fn(), preventDefault: jest.fn() });
  }

  empty(): void {
    this.children = [];
    this.textContent = '';
  }

  createDiv(options?: { cls?: string; text?: string; attr?: Record<string, string> }): MockElement {
    const el = new MockElement('div');
    if (options?.cls) el.className = options.cls;
    if (options?.text) el.textContent = options.text;
    if (options?.attr) {
      for (const [key, value] of Object.entries(options.attr)) {
        el.setAttribute(key, value);
      }
    }
    this.appendChild(el);
    return el;
  }

  querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const matches: MockElement[] = [];
    const traverse = (el: MockElement): void => {
      // Handle class selectors
      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        if (el.classList.contains(className)) {
          matches.push(el);
        }
      }
      for (const child of el.children) {
        traverse(child);
      }
    };
    traverse(this);
    return matches;
  }
}

describe('NavigationSidebar', () => {
  let parentEl: MockElement;
  let messagesEl: MockElement;
  let sidebar: NavigationSidebar;

  beforeEach(() => {
    parentEl = new MockElement('div');
    messagesEl = new MockElement('div');
    parentEl.appendChild(messagesEl);
  });

  afterEach(() => {
    sidebar?.destroy();
  });

  describe('initialization', () => {
    it('should create container with correct class', () => {
      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      expect(container).not.toBeNull();
    });

    it('should create four navigation buttons', () => {
      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      expect(container).not.toBeNull();
      expect(container!.children.length).toBe(4);
    });

    it('should set correct aria-labels on buttons', () => {
      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      const buttons = container!.children;

      expect(buttons[0].getAttribute('aria-label')).toBe('Scroll to top');
      expect(buttons[1].getAttribute('aria-label')).toBe('Previous message');
      expect(buttons[2].getAttribute('aria-label')).toBe('Next message');
      expect(buttons[3].getAttribute('aria-label')).toBe('Scroll to bottom');
    });

    it('should set correct icons on buttons', () => {
      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      const buttons = container!.children;

      expect(buttons[0].getAttribute('data-icon')).toBe('chevrons-up');
      expect(buttons[1].getAttribute('data-icon')).toBe('chevron-up');
      expect(buttons[2].getAttribute('data-icon')).toBe('chevron-down');
      expect(buttons[3].getAttribute('data-icon')).toBe('chevrons-down');
    });
  });

  describe('visibility', () => {
    it('should be hidden when content does not overflow', () => {
      messagesEl.scrollHeight = 500;
      messagesEl.clientHeight = 500;

      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      expect(container!.classList.contains('visible')).toBe(false);
    });

    it('should be visible when content overflows', () => {
      messagesEl.scrollHeight = 1000;
      messagesEl.clientHeight = 500;

      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      expect(container!.classList.contains('visible')).toBe(true);
    });

    it('should update visibility when updateVisibility is called', () => {
      messagesEl.scrollHeight = 500;
      messagesEl.clientHeight = 500;

      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      expect(container!.classList.contains('visible')).toBe(false);

      // Simulate content growth
      messagesEl.scrollHeight = 1000;
      sidebar.updateVisibility();

      expect(container!.classList.contains('visible')).toBe(true);
    });
  });

  describe('scroll to top button', () => {
    it('should scroll to top when clicked', () => {
      messagesEl.scrollHeight = 1000;
      messagesEl.clientHeight = 500;
      messagesEl.scrollTop = 500;

      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      const topBtn = container!.children[0];
      topBtn.click();

      expect(messagesEl.scrollToCalls.length).toBe(1);
      expect(messagesEl.scrollToCalls[0].top).toBe(0);
      expect(messagesEl.scrollToCalls[0].behavior).toBe('smooth');
    });
  });

  describe('scroll to bottom button', () => {
    it('should scroll to bottom when clicked', () => {
      messagesEl.scrollHeight = 1000;
      messagesEl.clientHeight = 500;
      messagesEl.scrollTop = 0;

      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      const container = parentEl.querySelector('.claudian-nav-sidebar');
      const bottomBtn = container!.children[3];
      bottomBtn.click();

      expect(messagesEl.scrollToCalls.length).toBe(1);
      expect(messagesEl.scrollToCalls[0].top).toBe(1000);
      expect(messagesEl.scrollToCalls[0].behavior).toBe('smooth');
    });
  });

  describe('destroy', () => {
    it('should remove container from DOM', () => {
      sidebar = new NavigationSidebar(
        parentEl as unknown as HTMLElement,
        messagesEl as unknown as HTMLElement
      );

      expect(parentEl.querySelector('.claudian-nav-sidebar')).not.toBeNull();

      sidebar.destroy();

      expect(parentEl.querySelector('.claudian-nav-sidebar')).toBeNull();
    });
  });
});
