import { useSeoMeta } from '@unhead/react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';

import { BuilderShell } from '@/components/builders/BuilderShell';
import { OutputPanel } from '@/components/builders/OutputPanel';
import { nsiteNodes } from '@/components/builders/tiptapNsiteNodes';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { demoProfile } from '@/lib/nsiteDemo';

const initialContent = `
  <div data-block="profile-hero"></div>
  <h2>What I'm working on</h2>
  <p>
    Most of my time goes into <strong>small, sharp tools</strong> for decentralized networks.
    Lately that means asking what a personal homepage looks like when
    <em>nobody can take it down</em>.
  </p>
  <ul>
    <li>Static sites published straight to Blossom</li>
    <li>Signed with a key I control</li>
    <li>No platform in the middle</li>
  </ul>
  <blockquote>
    <p>A homepage you actually own is a strange feeling in 2026.</p>
  </blockquote>
  <div data-block="link-list"></div>
  <div data-block="note-feed"></div>
  <div data-block="zap-callout"></div>
`;

/** Blocks insertable from the toolbar, mapping to the custom nodes. */
const insertableBlocks = [
  { label: 'Hero', type: 'profileHero' },
  { label: 'About', type: 'aboutSection' },
  { label: 'Links', type: 'linkList' },
  { label: 'Notes', type: 'noteFeed' },
  { label: 'Zap', type: 'zapCallout' },
];

function Toolbar({ editor }: { editor: Editor }) {
  // Subscribe to the exact editor state the toolbar renders, so buttons stay in
  // sync with the cursor without re-rendering on every keystroke.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      link: e.isActive('link'),
      alignLeft: e.isActive({ textAlign: 'left' }),
      alignCenter: e.isActive({ textAlign: 'center' }),
      alignRight: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="z-20 flex shrink-0 flex-wrap items-center gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-4" aria-hidden="true" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        pressed={state.bold}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.italic}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.strike}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
      >
        <Strikethrough className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.code}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label="Inline code"
      >
        <Code className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle size="sm" pressed={state.link} onPressedChange={setLink} aria-label="Link">
        <Link2 className="size-4" aria-hidden="true" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        pressed={state.h1}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <Heading1 className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.h2}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.h3}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
      >
        <Heading3 className="size-4" aria-hidden="true" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        pressed={state.bulletList}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <List className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.orderedList}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered list"
      >
        <ListOrdered className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.blockquote}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Blockquote"
      >
        <Quote className="size-4" aria-hidden="true" />
      </Toggle>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Toggle
        size="sm"
        pressed={state.alignLeft}
        onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
        aria-label="Align left"
      >
        <AlignLeft className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.alignCenter}
        onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
        aria-label="Align center"
      >
        <AlignCenter className="size-4" aria-hidden="true" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={state.alignRight}
        onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
        aria-label="Align right"
      >
        <AlignRight className="size-4" aria-hidden="true" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex flex-wrap items-center gap-1">
        <span className="px-1 text-xs font-medium text-muted-foreground">Insert</span>
        {insertableBlocks.map((block) => (
          <Button
            key={block.type}
            variant="outline"
            size="sm"
            onClick={() => editor.chain().focus().insertContent({ type: block.type }).run()}
          >
            {block.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function TiptapDemo() {
  useSeoMeta({
    title: 'Tiptap — nsite builder demo',
    description: 'Evaluating Tiptap as a WYSIWYG editor for building Nostr homepages.',
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { rel: 'noreferrer noopener' } },
      }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ...nsiteNodes,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'nsite-prose mx-auto max-w-3xl px-6 py-10 focus:outline-none',
      },
    },
  });

  // Re-read the serialized HTML whenever the document changes.
  const html = useEditorState({
    editor,
    selector: ({ editor: e }) => e?.getHTML() ?? '',
  });

  return (
    <BuilderShell slug="tiptap" docsUrl="https://tiptap.dev/docs">
      <div className="flex min-h-0 flex-1 flex-col">
        {editor && <Toolbar editor={editor} />}

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 py-8">
          <div className="mx-auto max-w-4xl rounded-xl border bg-background shadow-sm">
            <EditorContent editor={editor} />
          </div>
          <p className="mx-auto mt-4 max-w-4xl px-6 text-sm text-muted-foreground">
            Text is directly editable. Hover a structural block to reveal its fields — each one is a
            custom node with a React node view, written by hand for this demo. Profile:{' '}
            <span className="font-mono">{demoProfile.nip05}</span>
          </p>
        </div>

        <OutputPanel
          title="Tiptap output"
          description="Tiptap serializes to HTML directly, which suits an nsite well. Note that the custom blocks export as empty <div data-block> placeholders — their attributes are stored in the ProseMirror document, so a real implementation needs renderHTML to emit the full markup."
          language="html"
          content={html}
        />
      </div>
    </BuilderShell>
  );
}

export default TiptapDemo;
