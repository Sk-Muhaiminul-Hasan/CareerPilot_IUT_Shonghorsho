/**
 * MermaidChart — renders a Mermaid diagram string as SVG with Excalidraw-like zoom & pan.
 * Uses pointer events for dragging and wheel events for focal-point zooming.
 */
import { useEffect, useId, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';

interface MermaidChartProps {
  chart: string;
  /** Optional height cap (CSS value). Default: '350px'. */
  maxHeight?: string;
  /** Callback fired when a flowchart node is clicked. */
  onNodeClick?: (taskId: string) => void;
}

export default function MermaidChart({ chart, maxHeight = '350px', onNodeClick }: MermaidChartProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const id = useId().replace(/:/g, '');
  const chartId = `mermaid-${id}`;
  const mountedRef = useRef(true);

  // Pan and Zoom states
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pointer drag panning
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return; // Only drag with left click / primary pointer

    const target = event.target as HTMLElement;
    if (target.closest('.node') || target.closest('button') || target.closest('.MuiIconButton-root')) {
      return; // Do not pan if clicking interactive nodes/buttons
    }

    setIsDragging(true);
    dragStart.current = { x: event.clientX - position.x, y: event.clientY - position.y };
    dragDistance.current = 0;
    if (containerRef.current) {
      containerRef.current.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newX = event.clientX - dragStart.current.x;
    const newY = event.clientY - dragStart.current.y;

    const dx = newX - position.x;
    const dy = newY - position.y;
    dragDistance.current += Math.sqrt(dx * dx + dy * dy);

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      if (containerRef.current) {
        containerRef.current.releasePointerCapture(event.pointerId);
      }
    }
  };

  // Wheel focal-point zoom
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    // Only zoom, prevent scrolling parent page
    event.preventDefault();
    const zoomFactor = 1.1;
    let newScale = scale;
    if (event.deltaY < 0) {
      newScale = Math.min(scale * zoomFactor, 4);
    } else {
      newScale = Math.max(scale / zoomFactor, 0.4);
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const scaleChange = newScale - scale;
      setPosition((prev) => ({
        x: prev.x - (pointerX - prev.x) * (scaleChange / scale),
        y: prev.y - (pointerY - prev.y) * (scaleChange / scale),
      }));
    }

    setScale(newScale);
  };

  // Zoom controls
  const zoomIn = () => {
    setScale((prev) => Math.min(prev * 1.15, 4));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev / 1.15, 0.4));
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Click delegation handler to parse node clicks
  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onNodeClick) return;

    // If dragged more than 5px, treat it as panning, not a click
    if (dragDistance.current > 5) return;

    // Find the closest parent that represents a Mermaid flowchart node
    const nodeEl = (event.target as HTMLElement).closest('.node');
    if (!nodeEl) return;

    let cleanId = '';

    // 1. Try to extract from the HTML ID attribute
    const nodeIdAttr = nodeEl.getAttribute('id') || '';
    const match = nodeIdAttr.match(/task_([a-f0-9]{32})/i);
    if (match && match[1]) {
      cleanId = match[1];
    } else {
      // 2. Fall back to class names starting with "id-task_"
      const idClass = Array.from(nodeEl.classList).find((c) => c.startsWith('id-task_'));
      if (idClass) {
        cleanId = idClass.replace('id-task_', '');
      }
    }

    if (cleanId && cleanId.length === 32) {
      // Restore UUID dashes formatting (8-4-4-4-12) to match database primary keys
      const uuid = `${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}-${cleanId.slice(20)}`;
      onNodeClick(uuid);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    let cancelled = false;

    async function render() {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#e5eeff',
            primaryTextColor: '#1e293b',
            primaryBorderColor: '#004ac6',
            lineColor: '#94a3b8',
            sectionBkgColor: '#f0f4ff',
            altSectionBkgColor: '#ffffff',
            gridColor: '#e2e8f0',
            titleColor: '#1e293b',
            taskBkgColor: '#dbeafe',
            taskBorderColor: '#3b82f6',
            activeTaskBkgColor: '#bfdbfe',
            activeTaskBorderColor: '#1d4ed8',
            doneTaskBkgColor: '#dcfce7',
            doneTaskBorderColor: '#16a34a',
            critBkgColor: '#fef2f2',
            critBorderColor: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
          },
        });

        const { svg: rendered } = await mermaid.render(chartId, chart);
        if (!cancelled && mountedRef.current) {
          setSvg(rendered);
          setError(null);
          // Auto-center view on render
          setScale(1);
          setPosition({ x: 0, y: 0 });
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError('Unable to render flowchart. The chart data may be invalid.');
          console.warn('Mermaid render error:', err);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [chart, chartId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: '#fef2f2',
          border: '1px solid #fecaca',
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      sx={{
        position: 'relative',
        width: '100%',
        height: maxHeight,
        maxHeight,
        overflow: 'hidden',
        borderRadius: 2,
        bgcolor: '#f8faff',
        border: '1px solid #e2e8f0',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Zoom controls float */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 0.5,
          bgcolor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(4px)',
          borderRadius: 2,
          p: 0.5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          zIndex: 10,
        }}
      >
        <IconButton size="small" onClick={zoomIn} title="Zoom In">
          <ZoomInIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={zoomOut} title="Zoom Out">
          <ZoomOutIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={resetZoom} title="Reset View">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Pannable and Zoomable content canvas */}
      <Box
        onClick={handleContainerClick}
        sx={{
          width: '100%',
          height: '100%',
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': {
            maxWidth: '100%',
            maxHeight: '100%',
            height: 'auto',
          },
          '& .node': {
            cursor: 'pointer',
            '& rect, & polygon, & circle, & path': {
              transition: 'filter 0.15s ease',
            },
            '&:hover rect, &:hover polygon, &:hover circle, &:hover path': {
              filter: 'brightness(0.90)',
            },
            '&:active rect, &:active polygon, &:active circle, &:active path': {
              filter: 'brightness(0.82)',
            },
          },
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </Box>
  );
}
