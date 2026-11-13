import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Table,
  Image as ImageIcon,
  Undo2,
  Redo2,
  FileText,
  Printer,
  Download,
  Heading1,
  Heading2,
  Quote,
  Code,
  CheckSquare,
  Edit3,
  BookOpen,
} from 'lucide-react';

interface RichDocEditorPaneProps {
  title: string;
  html: string;
  plainText: string;
  mode: 'VIEW' | 'EDIT';
  onChange: (next: { html: string; plainText: string }) => void;
  onInsertImageRequest?: () => void;
  onEditSelectedImage?: (imageUrl: string) => void;
  onExportPdf?: () => void;
  onExportDocx?: () => void;
}

function extractHeadingsFromHtml(html: string): Array<{ level: number; text: string; id: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const nodes = Array.from(doc.querySelectorAll('h1, h2, h3'));
    return nodes.map((el, idx) => ({
      level: Number(el.tagName.slice(1)) || 1,
      text: (el.textContent || '').trim() || `Section ${idx + 1}`,
      id: `heading-${idx}`,
    }));
  } catch {
    return [];
  }
}

export const RichDocEditorPane: React.FC<RichDocEditorPaneProps> = ({
  title,
  html,
  plainText,
  mode,
  onChange,
  onInsertImageRequest,
  onEditSelectedImage,
  onExportPdf,
  onExportDocx,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedHtmlRef = useRef<string>('');
  const [pageLayout, setPageLayout] = useState<'A4' | 'PAGELESS'>('A4');
  const [showOutline, setShowOutline] = useState<boolean>(true);
  const [selectedImgSrc, setSelectedImgSrc] = useState<string | null>(null);

  const sanitizedHtml = useMemo(() => {
    const fallbackHtml =
      html ||
      `<p>${String(plainText || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>')}</p>`;
    return DOMPurify.sanitize(fallbackHtml, {
      ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'blockquote', 'pre', 'code'],
      ADD_ATTR: ['src', 'alt', 'style', 'class', 'colspan', 'rowspan', 'href', 'target'],
    });
  }, [html, plainText]);

  const headings = useMemo(() => extractHeadingsFromHtml(sanitizedHtml), [sanitizedHtml]);

  const wordStats = useMemo(() => {
    const clean = (plainText || '').trim();
    const words = clean ? clean.split(/\s+/).length : 0;
    const chars = (plainText || '').length;
    const readMins = Math.max(1, Math.ceil(words / 200));
    return { words, chars, readMins };
  }, [plainText]);

  // Sync incoming HTML when switching into EDIT mode, changing file, or receiving external updates (e.g., inserted/edited image)
  useEffect(() => {
    if (
      mode === 'EDIT' &&
      editorRef.current &&
      sanitizedHtml !== lastEmittedHtmlRef.current &&
      editorRef.current.innerHTML !== sanitizedHtml
    ) {
      editorRef.current.innerHTML = sanitizedHtml;
      lastEmittedHtmlRef.current = sanitizedHtml;
    }
  }, [mode, title, sanitizedHtml]);

  const emitEditorChange = () => {
    if (!editorRef.current) return;
    const nextHtml = editorRef.current.innerHTML;
    lastEmittedHtmlRef.current = nextHtml;
    const nextPlain = editorRef.current.innerText || '';
    onChange({ html: nextHtml, plainText: nextPlain });
  };

  const execCmd = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitEditorChange();
  };

  const insertTableHtml = () => {
    const tableHtml = `
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Header 1</th>
            <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Header 2</th>
            <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Header 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:8px;">Item A</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">Details</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">Status</td>
          </tr>
          <tr>
            <td style="border:1px solid #cbd5e1;padding:8px;">Item B</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">Details</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">Status</td>
          </tr>
        </tbody>
      </table><p><br/></p>`;
    execCmd('insertHTML', tableHtml);
  };

  const insertChecklistItem = () => {
    execCmd(
      'insertHTML',
      '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;"><input type="checkbox" /> <span>Action item...</span></div>'
    );
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=900,height=800');
    if (!w) return;
    w.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;max-width:780px;margin:0 auto;color:#0f172a;line-height:1.65;}
      table{width:100%;border-collapse:collapse;margin:12px 0;} td,th{border:1px solid #cbd5e1;padding:8px;}
      img{max-width:100%;border-radius:8px;}</style></head>
      <body><h1>${title}</h1>${sanitizedHtml}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
      {/* Formatting & Layout Toolbar */}
      <div className="px-3 sm:px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          {mode === 'EDIT' && (
            <>
              <button type="button" onClick={() => execCmd('undo')} title="Undo" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('redo')} title="Redo" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-slate-200 mx-1" />
              <button type="button" onClick={() => execCmd('formatBlock', '<h1>')} title="Heading 1" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Heading1 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('formatBlock', '<h2>')} title="Heading 2" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Heading2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('formatBlock', '<p>')} title="Paragraph" className="px-2 py-1 rounded-lg hover:bg-slate-100 text-[11px] font-bold text-slate-600 cursor-pointer">
                P
              </button>
              <span className="h-4 w-px bg-slate-200 mx-1" />
              <button type="button" onClick={() => execCmd('bold')} title="Bold" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('italic')} title="Italic" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('underline')} title="Underline" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('strikeThrough')} title="Strikethrough" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <input
                type="color"
                title="Text Color"
                defaultValue="#0f172a"
                onChange={(e) => execCmd('foreColor', e.target.value)}
                className="w-6 h-6 p-0.5 rounded border border-slate-200 cursor-pointer bg-white"
              />
              <span className="h-4 w-px bg-slate-200 mx-1" />
              <button type="button" onClick={() => execCmd('justifyLeft')} title="Align Left" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('justifyCenter')} title="Align Center" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('justifyRight')} title="Align Right" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <span className="h-4 w-px bg-slate-200 mx-1" />
              <button type="button" onClick={() => execCmd('insertUnorderedList')} title="Bullet List" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <List className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('insertOrderedList')} title="Numbered List" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={insertChecklistItem} title="Checklist" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('formatBlock', '<blockquote>')} title="Quote" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => execCmd('formatBlock', '<pre>')} title="Code Block" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Code className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={insertTableHtml} title="Insert Table" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer">
                <Table className="w-3.5 h-3.5" />
              </button>
              {onInsertImageRequest && (
                <button
                  type="button"
                  onClick={onInsertImageRequest}
                  title="Insert Image from File Manager"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-[#0B57D0] hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Image</span>
                </button>
              )}
              {selectedImgSrc && onEditSelectedImage && (
                <button
                  type="button"
                  onClick={() => onEditSelectedImage(selectedImgSrc)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Selected Image
                </button>
              )}
            </>
          )}
          {mode === 'VIEW' && (
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#0B57D0]" />
              {wordStats.words} words · {wordStats.chars} chars · ~{wordStats.readMins} min read
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowOutline((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
              showOutline ? 'bg-blue-50 border-blue-200 text-[#0B57D0]' : 'border-slate-200 text-slate-600'
            }`}
          >
            Outline ({headings.length})
          </button>
          <button
            type="button"
            onClick={() => setPageLayout((p) => (p === 'A4' ? 'PAGELESS' : 'A4'))}
            className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {pageLayout === 'A4' ? 'A4 Paper' : 'Pageless'}
          </button>
          {onExportDocx && (
            <button
              type="button"
              onClick={onExportDocx}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-[#0B57D0] text-xs font-semibold hover:bg-blue-100 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              .DOCX
            </button>
          )}
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body with Optional TOC Outline + Document Paper */}
      <div className="flex-1 flex overflow-hidden">
        {showOutline && (
          <aside className="hidden md:flex w-56 bg-white border-r border-slate-200 flex-col p-3 overflow-y-auto shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Document Outline
            </div>
            {headings.length === 0 ? (
              <p className="text-xs text-slate-400">Add H1/H2 headings to see an interactive outline.</p>
            ) : (
              <div className="space-y-1">
                {headings.map((h) => (
                  <div
                    key={h.id}
                    className={`text-xs truncate py-1 px-2 rounded-md text-slate-700 hover:bg-slate-100 ${
                      h.level === 2 ? 'pl-4 text-slate-600' : h.level >= 3 ? 'pl-6 text-slate-500' : 'font-semibold'
                    }`}
                  >
                    {h.text}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-auto pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div>Words: <strong>{wordStats.words}</strong></div>
              <div>Characters: <strong>{wordStats.chars}</strong></div>
              <div>Read time: <strong>{wordStats.readMins} min</strong></div>
            </div>
          </aside>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div
            className={`mx-auto bg-white rounded-xl border border-slate-200 shadow-sm transition-all ${
              pageLayout === 'A4' ? 'max-w-[816px] min-h-[1040px] p-8 sm:p-14' : 'max-w-5xl min-h-[600px] p-6 sm:p-10'
            }`}
          >
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 pb-4 mb-6 border-b border-slate-100">
              {title}
            </h1>

            {mode === 'EDIT' ? (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={emitEditorChange}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target && target.tagName === 'IMG') {
                    setSelectedImgSrc((target as HTMLImageElement).getAttribute('src'));
                  } else {
                    setSelectedImgSrc(null);
                  }
                }}
                className="min-h-[520px] outline-none prose prose-slate max-w-none text-slate-800 leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:bg-slate-50 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-2"
              />
            ) : (
              <div
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target && target.tagName === 'IMG' && onEditSelectedImage) {
                    const src = (target as HTMLImageElement).getAttribute('src');
                    if (src) onEditSelectedImage(src);
                  }
                }}
                className="prose prose-slate max-w-none text-slate-800 leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:bg-slate-50 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-2"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
