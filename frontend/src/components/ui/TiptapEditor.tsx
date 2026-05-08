"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Heading2,
  Heading3,
  List,
  Quote,
} from "lucide-react";

interface Props {
  // 초기 HTML. 마운트 시 1회만 적용. 부모가 외부에서 강제로 다시 채우려면 key 변경.
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * 어드민 게시물 작성용 리치 텍스트 에디터.
 * - StarterKit 의 Bold / Italic / Heading / Blockquote / BulletList 만 노출.
 * - 내부 상태는 TipTap 인스턴스가 관리하고, 변경 시 HTML 을 부모로 전달.
 */
export function TiptapEditor({ initialHtml, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: initialHtml || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // 빈 paragraph 만 있는 경우는 빈 문자열로 정규화
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "tiptap-content min-h-[200px] max-h-[400px] overflow-y-auto rounded-b-md border border-t-0 border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
  });

  // initialHtml 이 늦게 도착(예: 비동기 로드)할 경우 한 번 동기화
  useEffect(() => {
    if (!editor) return;
    if (initialHtml && editor.getHTML() === "<p></p>") {
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
    // 의존성 의도적으로 [editor] 만 — 사용자가 입력 중 prop 이 흔들려도 덮어쓰지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-400">
        에디터 로드 중...
      </div>
    );
  }

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-semibold transition-colors ${
      active
        ? "bg-[var(--color-primary)] text-white"
        : "text-zinc-600 hover:bg-zinc-200"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-zinc-300 bg-zinc-50 p-1.5">
      <button
        type="button"
        title="굵게"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        <BoldIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="기울임"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        <ItalicIcon className="h-3.5 w-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden />
      <button
        type="button"
        title="제목 H2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="제목 H3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-zinc-300" aria-hidden />
      <button
        type="button"
        title="인용"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="목록"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
