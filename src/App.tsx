/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Type, Languages, Image as ImageIcon, RefreshCw, ChevronRight, Trash2, LayoutGrid, Settings2, AlertCircle } from 'lucide-react';
import * as opentype from 'opentype.js';
import { jsPDF } from 'jspdf';

type ImageSize = {
  width: number;
  height: number;
  label: string;
  isCustom?: boolean;
  description?: string;
  fixedFontSize?: number;
  fixedLineHeight?: number;
  fixedLetterSpacing?: number;
};

const SIZES: ImageSize[] = [
  { 
    width: 1055, 
    height: 127, 
    label: '1055 x 127 px', 
    description: '字體總表字串圖（固定尺寸）',
    fixedLineHeight: 1.2,
    fixedLetterSpacing: 0
  },
  { 
    width: 700, 
    height: 166, 
    label: '700 x 166 px', 
    description: '新字體開發字樣圖（固定尺寸）',
    fixedLineHeight: 1.2,
    fixedLetterSpacing: 0
  },
  { 
    width: 1000, 
    height: 1000, 
    label: '自定義尺寸 (Custom)', 
    isCustom: true, 
    description: '版權圖片＆其他' 
  },
];

type LanguagePreset = {
  id: string;
  name: string;
  content: string;
};

const LANGUAGE_PRESETS: LanguagePreset[] = [
  {
    id: 'en',
    name: '英文 (English)',
    content: `1234567890.,;:!?
abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZ
"#$%&'()*+-/@[\\]^_` + '`' + `{|}~<=>`,
  },
  {
    id: 'latin-tr',
    name: '拉丁/土耳其文 (Latin/Turkish)',
    content: `1234567890.,;:!?
àbçđêfğhịjklmñøpqrşțüvwxýž
ÀBÇĐÊFĞHỊJKLMÑØPQRŞȚÜVWXÝŽ
€℃∂∆∏∑√∞∫≈≠≤≥◊ﬀﬁﬂﬃﬄ`,
  },
  {
    id: 'vi',
    name: '越南文 (Vietnamese)',
    content: `1234567890.,;:!?
ẳbçđêfğhỉjklmñợpqrşțüvwxýž
ẲBÇĐÊFĞHỈJKLMÑỢPQRŞȚÜVWXÝŽ
₫€℃∂∆∏∑√∞∫≈≠≤≥◊ﬀﬁﬂﬃﬄ`,
  },
  {
    id: 'th',
    name: '泰文 (Thai)',
    content: `1234567890.,;:!?
๑๒๓๔๕๖๗๘๙๐
กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟ
ภมยรฤลฦวศษสหฬอฮฯๅๆโใไ`,
  },
  {
    id: 'ru',
    name: '俄文 (Russian)',
    content: `1234567890.,;:!?
åвçdëfghijktmñôþqrṣṭúvwxyž
гдйклмнопрстчшыэюяѓељњќўџА
°C°F€0fiflß∞бЖжф[]≥=-_√#≥`,
  },
  {
    id: 'ar',
    name: '阿拉伯文 (Arabic)',
    content: `0123456789
نصٌّ حكيمٌ لهُ سِرٌّ قاطِعٌ وَذُو شَأنٍ
عَظيمٍ مكتوبٌ على ثوبٍ أخضرَ ومُغلفٌ بجلدٍ
ابجد هوز حطي كلمن سعفص قرشت ثخذ`,
  },
  {
    id: 'custom',
    name: '其他語言 (Custom)',
    content: '',
  },
];

type LoadedFont = {
  id: string;
  font: opentype.Font;
  fontFamily: string;
  fileName: string;
};

export default function App() {
  const [fonts, setFonts] = useState<LoadedFont[]>([]);
  const [selectedFontId, setSelectedFontId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<ImageSize>(SIZES[0]);
  const [selectedLang, setSelectedLang] = useState<LanguagePreset>(LANGUAGE_PRESETS[0]);
  const [customText, setCustomText] = useState<string>('');
  const [temp700Text, setTemp700Text] = useState<string>(LANGUAGE_PRESETS[0].content);
  const [singleLineText, setSingleLineText] = useState<string>('The quick brown fox jumps over the lazy dog');
  const [fontSize, setFontSize] = useState<number>(32);
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [letterSpacing, setLetterSpacing] = useState<number>(0);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'jpg'>('png');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom size states
  const [customWidth, setCustomWidth] = useState<number>(1000);
  const [customHeight, setCustomHeight] = useState<number>(1000);
  
  // Collage states
  const [isCollageMode, setIsCollageMode] = useState(false);
  const [collageLayout, setCollageLayout] = useState<'grid' | 'vertical'>('grid');
  const [selectedCollageIds, setSelectedCollageIds] = useState<string[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedLang.id === 'custom') {
      setTemp700Text(LANGUAGE_PRESETS[0].content);
    } else {
      setTemp700Text(selectedLang.content);
    }
  }, [selectedLang]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFonts: LoadedFont[] = [];
    const fileList = Array.from(files) as File[];

    for (const file of fileList) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadedFont = opentype.parse(arrayBuffer);
        
        const id = `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fontFace = new FontFace(id, arrayBuffer);
        await fontFace.load();
        document.fonts.add(fontFace);
        
        newFonts.push({
          id,
          font: loadedFont,
          fontFamily: id,
          fileName: file.name
        });
      } catch (err) {
        console.error(`Error loading font ${file.name}:`, err);
      }
    }

    if (newFonts.length > 0) {
      setFonts(prev => {
        const updated = [...prev, ...newFonts];
        if (!selectedFontId) setSelectedFontId(newFonts[0].id);
        return updated;
      });
      setSelectedCollageIds(prev => [...prev, ...newFonts.map(f => f.id)]);
      
      // Default font size adjustment
      if (selectedSize.width === 1055) {
        setFontSize(32);
      } else {
        setFontSize(28);
      }
    }
  };

  const removeFont = (id: string) => {
    setFonts(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (selectedFontId === id) {
        setSelectedFontId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
    setSelectedCollageIds(prev => prev.filter(fid => fid !== id));
  };

  const toggleCollageSelection = (id: string) => {
    setSelectedCollageIds(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const currentFont = fonts.find(f => f.id === selectedFontId);

  const getActiveDimensions = () => {
    if (selectedSize.isCustom) {
      return { width: customWidth, height: customHeight };
    }
    return { width: selectedSize.width, height: selectedSize.height };
  };

  const activeFontSize = selectedSize.fixedFontSize ?? fontSize;
  const activeLineHeight = selectedSize.fixedLineHeight ?? lineHeight;
  const activeLetterSpacing = selectedSize.fixedLetterSpacing ?? letterSpacing;

  const getSpecimenText = () => {
    const is1055 = selectedSize.width === 1055 && !selectedSize.isCustom;
    const is700 = selectedSize.width === 700 && !selectedSize.isCustom;
    
    if (is700) {
      return temp700Text;
    }
    if (is1055) {
      return singleLineText;
    }
    return selectedLang.id === 'custom' ? customText : selectedLang.content;
  };

  const getWrappedLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, isSingleLine: boolean) => {
    if (isSingleLine) return [text];
    
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    
    // Set letter spacing for measurement
    (ctx as any).letterSpacing = `${activeLetterSpacing}px`;
    
    paragraphs.forEach(p => {
      if (p.length === 0) {
        lines.push("");
        return;
      }
      
      let currentLine = "";
      const chars = p.split('');
      
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i] as string;
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
    });
    return lines;
  };

  const drawSingleFont = (ctx: CanvasRenderingContext2D, font: LoadedFont, width: number, height: number) => {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Set font styles
    ctx.font = `${activeFontSize}px "${font.fontFamily}"`;
    (ctx as any).letterSpacing = `${activeLetterSpacing}px`;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    
    const isRtl = selectedLang.id === 'ar';
    ctx.direction = isRtl ? 'rtl' : 'ltr';
    ctx.textAlign = isRtl ? 'right' : 'left';

    const isSingleLineSize = selectedSize.width === 1055 && !selectedSize.isCustom;
    const rawText = getSpecimenText();
    
    const padding = 40;
    const maxWidth = width - (padding * 2);
    
    const lines = getWrappedLines(ctx, rawText, maxWidth, isSingleLineSize);
    
    // Calculate total height
    const totalLinesHeight = lines.length * activeFontSize * activeLineHeight;
    const startY = (height - totalLinesHeight) / 2 + (activeFontSize * activeLineHeight) / 2;
    
    // Alignment
    const xPos = isRtl ? width - padding : padding;

    lines.forEach((line, index) => {
      ctx.fillText(line, xPos, startY + index * activeFontSize * activeLineHeight);
    });
  };

  const drawCollage = (ctx: CanvasRenderingContext2D, collageFonts: LoadedFont[], totalWidth: number, totalHeight: number, cellWidth: number, cellHeight: number, scale: number = 1) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Scale everything if we capped at 5000px
    ctx.scale(scale, scale);

    const count = collageFonts.length;
    const cols = Math.ceil(Math.sqrt(count));

    for (let i = 0; i < collageFonts.length; i++) {
      const f = collageFonts[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = col * cellWidth;
      const y = row * cellHeight;

      // Draw cell border
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellWidth, cellHeight);

      // Draw Font Label
      const labelFontSize = Math.max(14, Math.min(48, Math.round(cellHeight * 0.08)));
      const labelHeight = Math.round(labelFontSize * 1.8);
      
      ctx.fillStyle = '#f9f9f9';
      ctx.fillRect(x + 2, y + 2, cellWidth - 4, labelHeight);
      ctx.fillStyle = '#333333';
      ctx.font = `bold ${labelFontSize}px sans-serif`;
      (ctx as any).letterSpacing = '0px'; // Labels don't use custom letter spacing
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.fileName, x + labelFontSize * 0.75, y + labelHeight / 2 + 2);

      // Draw Specimen
      const isSingleLine = selectedSize.width === 1055 && !selectedSize.isCustom;
      const rawText = getSpecimenText();
      
      ctx.save();
      // Clip to cell to prevent overlap
      ctx.beginPath();
      ctx.rect(x + 5, y + labelHeight + 5, cellWidth - 10, cellHeight - labelHeight - 10);
      ctx.clip();

      ctx.font = `${activeFontSize}px "${f.fontFamily}"`;
      (ctx as any).letterSpacing = `${activeLetterSpacing}px`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'middle';
      
      const isRtl = selectedLang.id === 'ar';
      ctx.textAlign = isRtl ? 'right' : 'left';
      const padding = 40;
      const maxWidth = cellWidth - (padding * 2);
      const xPos = isRtl ? x + cellWidth - padding : x + padding;

      const lines = getWrappedLines(ctx, rawText, maxWidth, isSingleLine);
      const totalLinesHeight = lines.length * activeFontSize * activeLineHeight;
      const startY = y + (cellHeight + labelHeight - totalLinesHeight) / 2 + (activeFontSize * activeLineHeight) / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, xPos, startY + index * activeFontSize * activeLineHeight);
      });
      
      ctx.restore();
    }
    ctx.restore();
  };

  const drawCanvas = useCallback((targetFont?: LoadedFont) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = getActiveDimensions();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isCollageMode && selectedCollageIds.length > 1) {
      const collageFonts = fonts.filter(f => selectedCollageIds.includes(f.id));
      const count = collageFonts.length;
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      
      const cellWidth = width;
      const cellHeight = height;
      
      // For preview, we use the canvas dimensions provided by getActiveDimensions
      // but we need to adjust the canvas size to fit the collage
      const totalWidth = cols * cellWidth;
      const totalHeight = rows * cellHeight;
      
      // Update canvas size for collage preview
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      
      drawCollage(ctx, collageFonts, totalWidth, totalHeight, cellWidth, cellHeight);
    } else {
      const fontToDraw = targetFont || currentFont;
      if (!fontToDraw) return;
      
      // Reset canvas size for single font preview
      canvas.width = width;
      canvas.height = height;
      
      drawSingleFont(ctx, fontToDraw, width, height);
    }
  }, [fonts, currentFont, selectedSize, selectedLang, customText, temp700Text, singleLineText, fontSize, lineHeight, letterSpacing, customWidth, customHeight, isCollageMode, selectedCollageIds]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const downloadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas || fonts.length === 0) return;

    setIsGenerating(true);
    
    const { width, height } = getActiveDimensions();

    // Helper to trigger download
    const triggerDownload = (dataUrl: string, fileName: string) => {
      if (exportFormat === 'pdf') {
        const pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        pdf.save(fileName.replace('.png', '.pdf').replace('.jpg', '.pdf'));
      } else {
        const link = document.createElement('a');
        const ext = exportFormat === 'jpg' ? 'jpg' : 'png';
        link.download = fileName.replace('.png', `.${ext}`);
        link.href = dataUrl;
        link.click();
      }
    };

    try {
      const collageFonts = fonts.filter(f => selectedCollageIds.includes(f.id));
      
      if (isCollageMode && collageFonts.length > 1) {
        // Collage logic
        const count = collageFonts.length;
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        
        // Use active dimensions as cell size
        const cellWidth = width;
        const cellHeight = height;

        // Calculate total collage size
        let totalWidth = cols * cellWidth;
        let totalHeight = rows * cellHeight;

        // Cap at 5000px
        const MAX_DIM = 5000;
        let collageScale = 1;
        if (totalWidth > MAX_DIM || totalHeight > MAX_DIM) {
          collageScale = Math.min(MAX_DIM / totalWidth, MAX_DIM / totalHeight);
          totalWidth *= collageScale;
          totalHeight *= collageScale;
        }

        const collageCanvas = document.createElement('canvas');
        collageCanvas.width = totalWidth;
        collageCanvas.height = totalHeight;
        const cCtx = collageCanvas.getContext('2d');
        if (!cCtx) return;

        drawCollage(cCtx, collageFonts, totalWidth, totalHeight, cellWidth, cellHeight, collageScale);

        const ext = exportFormat === 'jpg' ? 'jpg' : 'png';
        const fileName = `collage-${Math.round(totalWidth)}x${Math.round(totalHeight)}-${Date.now()}.${ext}`;
        const mimeType = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = exportFormat === 'jpg' ? 0.9 : 1.0;
        
        if (exportFormat === 'pdf') {
          const pdf = new jsPDF({
            orientation: totalWidth > totalHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [totalWidth, totalHeight]
          });
          pdf.addImage(collageCanvas.toDataURL('image/png'), 'PNG', 0, 0, totalWidth, totalHeight);
          pdf.save(fileName.replace('.png', '.pdf').replace('.jpg', '.pdf'));
        } else {
          triggerDownload(collageCanvas.toDataURL(mimeType, quality), fileName);
        }
      } else {
        // Loop through selected fonts and generate images
        const fontsToProcess = collageFonts.length > 0 ? collageFonts : (currentFont ? [currentFont] : []);
        
        if (exportFormat === 'pdf' && fontsToProcess.length > 1) {
          // Multi-page PDF for batch processing
          const pdf = new jsPDF({
            orientation: width > height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [width, height]
          });

          for (let i = 0; i < fontsToProcess.length; i++) {
            const f = fontsToProcess[i];
            drawCanvas(f);
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (i > 0) pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
          }
          
          pdf.save(`batch-export-${Date.now()}.pdf`);
        } else {
          for (const f of fontsToProcess) {
            drawCanvas(f);
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const fontName = f.fileName.split('.')[0];
            const ext = exportFormat === 'jpg' ? 'jpg' : 'png';
            const fileName = `${fontName}-${width}x${height}.${ext}`;
            const mimeType = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
            const quality = exportFormat === 'jpg' ? 0.9 : 1.0;
            
            triggerDownload(canvas.toDataURL(mimeType, quality), fileName);
          }
        }
      }
    } finally {
      // Restore preview of selected font
      drawCanvas();
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#141414]/10 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-6xl font-serif italic tracking-tight">HyFont字樣圖片快速產出工具</h1>
            <p className="text-sm uppercase tracking-widest opacity-50 font-mono">Professional Character Specimen Tool</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-[#141414] text-[#F5F5F0] rounded-full hover:bg-opacity-90 transition-all active:scale-95 shadow-lg"
            >
              <Upload size={18} />
              <span>{fonts.length > 0 ? '新增字體' : '上傳 TTF / OTF'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".ttf,.otf"
              multiple
              className="hidden"
            />
          </div>
        </header>

        {fonts.length > 0 ? (
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Column: Controls */}
            <div className="lg:col-span-4 space-y-8">
              {/* Font List */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                  <Type size={14} />
                  <span>已載入字體 ({fonts.length})</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {fonts.map((f) => (
                    <div 
                      key={f.id}
                      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedFontId === f.id 
                          ? 'bg-white border-[#141414] shadow-md' 
                          : 'bg-white/50 border-[#141414]/5 hover:border-[#141414]/20'
                      }`}
                      onClick={() => setSelectedFontId(f.id)}
                    >
                      <div 
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollageSelection(f.id);
                        }}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedCollageIds.includes(f.id) ? 'bg-[#141414] border-[#141414]' : 'border-[#141414]/20'}`}>
                          {selectedCollageIds.includes(f.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.fileName}</p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFont(f.id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Size Selection */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                  <ImageIcon size={14} />
                  <span>圖片尺寸規範</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {SIZES.map((size) => (
                    <button
                      key={size.label}
                      onClick={() => {
                        setSelectedSize(size);
                        if (size.width === 1055 && !size.isCustom) {
                          setFontSize(32);
                        } else {
                          setFontSize(28);
                        }
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        selectedSize.label === size.label
                          ? 'bg-[#141414] text-white border-[#141414]'
                          : 'bg-white border-[#141414]/10 hover:border-[#141414]/30'
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{size.label}</span>
                        {(size as any).description && (
                          <span className={`text-sm font-medium opacity-60 ${selectedSize.label === size.label ? 'text-white/80' : 'text-[#141414]/60'}`}>
                            {(size as any).description}
                          </span>
                        )}
                      </div>
                      {selectedSize.label === size.label && <ChevronRight size={16} />}
                    </button>
                  ))}
                </div>
              </section>

              {/* Custom Size Inputs */}
              {selectedSize.isCustom && (
                <section className="p-6 bg-white rounded-3xl shadow-sm border border-[#141414]/5 space-y-6 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                    <Settings2 size={14} />
                    <span>自定義尺寸 (400 - 5000px, 以 100 為單位)</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] uppercase opacity-40">
                        <span>寬度 (Width)</span>
                        <span className="font-mono">{customWidth}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="400" 
                        max="5000"
                        step="100"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                        className="w-full accent-[#141414]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] uppercase opacity-40">
                        <span>高度 (Height)</span>
                        <span className="font-mono">{customHeight}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="400" 
                        max="5000"
                        step="100"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(parseInt(e.target.value))}
                        className="w-full accent-[#141414]"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Input Section */}
              {selectedSize.width === 700 && !selectedSize.isCustom ? (
                /* Editable Specimen for 700x166 (resets on lang change) */
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                    <Languages size={14} />
                    <span>語言預設 (700x166 規範)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGUAGE_PRESETS.filter(l => l.id !== 'custom').map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setSelectedLang(lang)}
                        className={`p-3 text-sm rounded-xl border transition-all ${
                          selectedLang.id === lang.id
                            ? 'bg-[#141414] text-white border-[#141414]'
                            : 'bg-white border-[#141414]/10 hover:border-[#141414]/30'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                      <RefreshCw size={14} />
                      <span>編輯字樣 (點選語言可重置)</span>
                    </div>
                    <textarea
                      value={temp700Text}
                      onChange={(e) => setTemp700Text(e.target.value)}
                      placeholder="在此編輯規範字樣..."
                      className="w-full h-24 p-3 bg-white rounded-2xl border border-[#141414]/10 focus:outline-none focus:ring-2 focus:ring-[#141414]/20 font-mono text-xs resize-none"
                    />
                  </div>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-[10px] text-amber-800 italic">
                    此尺寸規範下，切換語言將會重置字樣內容。
                  </div>
                </section>
              ) : selectedSize.isCustom ? (
                <>
                  {/* Language Selection for Custom */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                      <Languages size={14} />
                      <span>語言預設 (自定義尺寸)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {LANGUAGE_PRESETS.map((lang) => (
                        <button
                          key={lang.id}
                          onClick={() => setSelectedLang(lang)}
                          className={`p-3 text-sm rounded-xl border transition-all ${
                            selectedLang.id === lang.id
                              ? 'bg-[#141414] text-white border-[#141414]'
                              : 'bg-white border-[#141414]/10 hover:border-[#141414]/30'
                          }`}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Custom Text Area */}
                  {selectedLang.id === 'custom' && (
                    <section className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                        <RefreshCw size={14} />
                        <span>自訂字符預覽</span>
                      </div>
                      <textarea
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="在此輸入自訂字符..."
                        className="w-full h-32 p-4 bg-white rounded-2xl border border-[#141414]/10 focus:outline-none focus:ring-2 focus:ring-[#141414]/20 font-mono text-sm resize-none"
                      />
                    </section>
                  )}
                </>
              ) : (
                /* Single Line Input for 1055 */
                <section className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                    <Type size={14} />
                    <span>單行字樣預覽</span>
                  </div>
                  <input
                    type="text"
                    value={singleLineText}
                    onChange={(e) => setSingleLineText(e.target.value)}
                    placeholder="輸入單行字樣..."
                    className="w-full p-4 bg-white rounded-2xl border border-[#141414]/10 focus:outline-none focus:ring-2 focus:ring-[#141414]/20 font-mono text-sm"
                  />
                </section>
              )}

              {/* Collage Mode Toggle */}
              {fonts.length > 1 && (
                <section className="p-6 bg-amber-50 rounded-3xl border border-amber-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase text-amber-800">
                      <LayoutGrid size={14} />
                      <span>組合合併圖片需求</span>
                    </div>
                    <button
                      onClick={() => setIsCollageMode(!isCollageMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isCollageMode ? 'bg-amber-600' : 'bg-amber-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCollageMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  {isCollageMode && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2 text-[10px] text-amber-700 leading-relaxed">
                        <AlertCircle size={12} className="shrink-0 mt-0.5" />
                        <p>越多張的圖片合併，每張圖的字樣會越小越不清晰，合併的圖片建議一次不超過4張為基準。</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedCollageIds(fonts.map(f => f.id))}
                          className="text-[10px] font-mono uppercase bg-white/50 px-2 py-1 rounded border border-amber-200 hover:bg-white transition-colors"
                        >
                          全選
                        </button>
                        <button 
                          onClick={() => setSelectedCollageIds([])}
                          className="text-[10px] font-mono uppercase bg-white/50 px-2 py-1 rounded border border-amber-200 hover:bg-white transition-colors"
                        >
                          清除
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Adjustments */}
              <section className="p-6 bg-white rounded-3xl shadow-sm border border-[#141414]/5 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider">樣式調整</h3>
                  {(selectedSize.fixedLineHeight !== undefined || selectedSize.fixedLetterSpacing !== undefined) && (
                    <span className="text-[10px] bg-[#141414] text-white px-2 py-0.5 rounded-full">部分參數固定不開放調整</span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-mono uppercase opacity-50">
                    <span>字體大小</span>
                    <span>{activeFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="300"
                    value={activeFontSize}
                    disabled={selectedSize.fixedFontSize !== undefined}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-[#141414]"
                  />
                </div>
                <div className="space-y-3">
                  <div className={`space-y-3 transition-opacity ${selectedSize.fixedLineHeight !== undefined ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between text-xs font-mono uppercase opacity-50">
                      <span>行高</span>
                      <span>{activeLineHeight.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={activeLineHeight}
                      disabled={selectedSize.fixedLineHeight !== undefined}
                      onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                      className="w-full accent-[#141414]"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className={`space-y-3 transition-opacity ${selectedSize.fixedLetterSpacing !== undefined ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between text-xs font-mono uppercase opacity-50">
                      <span>字距 (Letter Spacing)</span>
                      <span>{activeLetterSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="100"
                      step="1"
                      value={activeLetterSpacing}
                      disabled={selectedSize.fixedLetterSpacing !== undefined}
                      onChange={(e) => setLetterSpacing(parseInt(e.target.value))}
                      className="w-full accent-[#141414]"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Preview & Export */}
            <div className="lg:col-span-8 space-y-8">
              <div className="sticky top-8 space-y-6">
                {/* Preview Area */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase opacity-50">
                      <ImageIcon size={14} />
                      <span>畫布預覽</span>
                    </div>
                    <div className="text-[10px] font-mono opacity-30">
                      {(() => {
                        const { width, height } = getActiveDimensions();
                        return `${width} x ${height}`;
                      })()}
                    </div>
                  </div>
                  
                  <div className="relative group bg-[#E4E3E0] rounded-3xl p-4 md:p-12 flex items-center justify-center border border-[#141414]/5 min-h-[200px] overflow-hidden">
                    {(() => {
                      const { width, height } = getActiveDimensions();
                      
                      let displayWidth = width;
                      let displayHeight = height;
                      
                      if (isCollageMode && selectedCollageIds.length > 1) {
                        const collageFonts = fonts.filter(f => selectedCollageIds.includes(f.id));
                        const count = collageFonts.length;
                        const cols = Math.ceil(Math.sqrt(count));
                        const rows = Math.ceil(count / cols);
                        displayWidth = cols * width;
                        displayHeight = rows * height;
                      }

                      return (
                        <div 
                          className="shadow-2xl transition-all duration-500 bg-white overflow-hidden"
                          style={{ 
                            width: '100%',
                            maxWidth: displayWidth,
                            aspectRatio: `${displayWidth} / ${displayHeight}`
                          }}
                        >
                          <canvas
                            ref={canvasRef}
                            width={displayWidth}
                            height={displayHeight}
                            style={{
                              width: '100%',
                              height: 'auto',
                              display: 'block'
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Export Format Selection */}
                <div className="p-4 bg-white/50 rounded-3xl border border-[#141414]/5 space-y-3">
                  <div className="text-[10px] font-mono uppercase opacity-50 px-2">匯出格式 (Export Format)</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportFormat('png')}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${exportFormat === 'png' ? 'bg-[#141414] text-white shadow-md' : 'bg-white text-[#141414] border border-[#141414]/10 hover:bg-white/80'}`}
                    >
                      PNG
                    </button>
                    <button
                      onClick={() => setExportFormat('jpg')}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${exportFormat === 'jpg' ? 'bg-[#141414] text-white shadow-md' : 'bg-white text-[#141414] border border-[#141414]/10 hover:bg-white/80'}`}
                    >
                      JPG
                    </button>
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${exportFormat === 'pdf' ? 'bg-[#141414] text-white shadow-md' : 'bg-white text-[#141414] border border-[#141414]/10 hover:bg-white/80'}`}
                    >
                      PDF
                    </button>
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={downloadImage}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-3 py-6 bg-[#141414] text-[#F5F5F0] rounded-3xl hover:bg-opacity-90 transition-all active:scale-[0.98] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <RefreshCw className="animate-spin" size={24} />
                  ) : (
                    <Download size={24} />
                  )}
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-xl font-medium">產出並下載{exportFormat === 'pdf' ? '文件' : '圖片'}</span>
                    <span className="text-[10px] opacity-50 uppercase tracking-widest">
                      {isCollageMode ? `組合合併 ${selectedCollageIds.length} 款字體` : (fonts.length > 1 ? `批次處理 ${fonts.length} 款字重` : '單一字重產出')}
                    </span>
                  </div>
                </button>

                <div className="p-6 bg-white/50 rounded-2xl border border-[#141414]/5">
                  <h4 className="text-sm font-medium mb-2">使用提示：</h4>
                  <ul className="text-xs space-y-1 opacity-60 list-disc pl-4">
                    <li>自定義尺寸範圍：400x400px 至 5000x5000px。</li>
                    <li>1055x127 僅支援單行字樣。</li>
                    <li>700x166 尺寸已根據語言規範預設字符。</li>
                    <li>若選擇「其他語言」或「自定義尺寸」，請在左側輸入框輸入您想產出的字符。</li>
                    <li>您可以調整字體大小與行高以達到最佳視覺效果。</li>
                    <li>下載的圖片將維持原始像素尺寸。</li>
                  </ul>
                </div>
              </div>
            </div>
          </main>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl border border-[#141414]/5">
              <Upload size={40} className="text-[#141414]/20" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-medium">請先上傳字體檔案</h2>
              <p className="text-[#141414]/40 max-w-md">
                上傳 TTF 或 OTF 格式的字體檔案，即可開始產出符合規範的字符字樣圖片。
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-4 bg-[#141414] text-[#F5F5F0] rounded-full hover:shadow-2xl transition-all active:scale-95"
            >
              立即上傳
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-12 border-t border-[#141414]/10 flex flex-col md:flex-row justify-between gap-4 text-[10px] font-mono uppercase opacity-30">
          <div>© 2024 HyFont字樣圖片快速產出工具</div>
          <div className="flex gap-6">
            <span>AI Powered Concept Generation</span>
            <span>Batch Processing Enabled</span>
            <span>PDF Export Support</span>
            <span>1055x127 Extended</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
