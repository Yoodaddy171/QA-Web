'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, RefreshCw, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBasketballDropzoneSetting } from '@/hooks/use-basketball-dropzone-setting';
import { playBasketballSound } from '@/lib/client/basketball-sound';
import { ShotMeterGauge, getShotTimingQuality, type ShotTimingQuality } from '@/components/basketball/ShotMeterGauge';

export interface BasketballUploadDropzoneProps {
  title?: string;
  subtitle?: string;
  dropLabel?: string;
  accept?: string;
  disabled?: boolean;
  busy?: boolean;
  uploadedCount?: number;
  defaultBadge?: string;
  helperText?: string;
  helperBadges?: string[];
  selectedFile?: { name: string; size?: number } | null;
  actionButtonLabel?: string;
  onActionButtonClick?: () => void;
  onClearFile?: () => void;
  onFileSelect: (file: File) => void | Promise<void>;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  inputAriaLabel?: string;
  compact?: boolean;
  className?: string;
  interactiveDropzone?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface ArcGeometry {
  width: number;
  height: number;
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  d: string;
  dots: Array<{ x: number; y: number; r: number; opacity: number }>;
}

import {
  StandardUploadDropzone,
  formatFileSize,
  getFileExtensionBadge,
} from '@/components/basketball/StandardUploadDropzone';

export function BasketballUploadDropzone(props: BasketballUploadDropzoneProps) {
  const { isBasketballEnabled: globalBasketballEnabled } = useBasketballDropzoneSetting();
  const isBasketballActive = props.interactiveDropzone ?? globalBasketballEnabled;

  if (!isBasketballActive) {
    return <StandardUploadDropzone {...props} />;
  }

  return <BasketballCourtDropzone {...props} />;
}

function BasketballCourtDropzone({
  title = 'Upload files',
  subtitle = 'Drag and drop, or take the shot.',
  dropLabel = 'Drop files here',
  accept,
  disabled = false,
  busy = false,
  uploadedCount,
  defaultBadge = 'DOC',
  helperText,
  helperBadges,
  selectedFile,
  actionButtonLabel,
  onActionButtonClick,
  onClearFile,
  onFileSelect,
  inputRef: externalInputRef,
  inputAriaLabel,
  compact = false,
  className,
}: BasketballUploadDropzoneProps) {
  const isBasketballActive = true;

  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = externalInputRef ?? internalInputRef;
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const courtRef = useRef<HTMLDivElement | null>(null);
  const hoopTargetRef = useRef<HTMLDivElement | null>(null);
  const puckRestRef = useRef<HTMLDivElement | null>(null);
  const pendingPickAfterShotRef = useRef(false);
  const inputId = useId();

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [localUploadedCount, setLocalUploadedCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [activeFile, setActiveFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'shooting' | 'uploading' | 'done'>('idle');
  const [netSwish, setNetSwish] = useState(false);
  const [shotSplash, setShotSplash] = useState<{ points: 2 | 3; quality: ShotTimingQuality; key: number } | null>(null);
  const [releaseFeedback, setReleaseFeedback] = useState<{
    quality: ShotTimingQuality;
    points: 2 | 3;
    key: number;
  } | null>(null);

  // NBA 2K-Style Shot Meter State
  const [meterProgress, setMeterProgress] = useState(0);
  const meterProgressRef = useRef(0);
  // Settled position on court floor after a missed shot (null when at default center)
  const [puckFloorPos, setPuckFloorPos] = useState<Point | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  // Cursor position inside arena when aiming (either via pointer drag OR OS file drag hover)
  const [isPointerAiming, setIsPointerAiming] = useState(false);
  const [aimPoint, setAimPoint] = useState<Point | null>(null);
  const aimPointRef = useRef<Point | null>(null);

  // Flying puck animation state (in arena coordinates)
  const [flightPos, setFlightPos] = useState<{ x: number; y: number; scale: number; rotate: number } | null>(null);
  const [arcGeometry, setArcGeometry] = useState<ArcGeometry | null>(null);
  const [courtSize, setCourtSize] = useState<{ width: number; height: number }>(() => ({
    width: 960,
    height: compact ? 520 : 640,
  }));

  useEffect(() => {
    const el = courtRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCourtSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact]);

  const displayFile = selectedFile
    ? { name: selectedFile.name, size: selectedFile.size ?? activeFile?.size ?? 0 }
    : activeFile;

  const badgeText = getFileExtensionBadge(displayFile?.name, defaultBadge);
  const effectiveUploadedCount = typeof uploadedCount === 'number' ? uploadedCount : localUploadedCount;
  const isActivelyAiming = isBasketballActive && (isPointerAiming || isDraggingOver) && Boolean(aimPoint) && !flightPos;

  // NBA 2K Shot Meter Oscillation Effect (Smooth 60fps Triangle Wave)
  useEffect(() => {
    if (!isBasketballActive || !isActivelyAiming) {
      setMeterProgress(0);
      meterProgressRef.current = 0;
      return;
    }

    let animId: number;
    const startTime = performance.now();

    const loop = (now: number) => {
      const elapsed = now - startTime;
      const period = 1000; // 1.0s full oscillation cycle
      const phase = (elapsed % period) / period;
      const val = phase < 0.5 ? phase * 2 * 100 : (1 - (phase - 0.5) * 2) * 100;
      const rounded = Math.round(val);
      meterProgressRef.current = rounded;
      setMeterProgress(rounded);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isBasketballActive, isActivelyAiming]);

  // Pixel-accurate half-court geometry (1 SVG unit = 1 CSS pixel, zero distortion)
  const courtW = Math.max(320, courtSize.width);
  const courtH = Math.max(compact ? 500 : 620, courtSize.height);
  const courtCx = Math.round(courtW / 2);
  const cornerBreakY = Math.round(courtH * 0.25);
  const keyW = Math.round(Math.min(228, Math.max(168, courtW * 0.21)));
  const keyLeft = Math.round(courtCx - keyW / 2);
  const keyRight = Math.round(courtCx + keyW / 2);
  const freeThrowY = Math.round(courtH * 0.50);
  const ftRadius = Math.round(keyW * 0.37);
  const restrictedRadius = Math.round(keyW * 0.25);
  const restrictedBreakY = Math.round(courtH * 0.14);
  const arcRx = Math.round(Math.min(courtW * 0.40, Math.max(230, courtH * 0.56)));
  const arcRy = Math.round(courtH * 0.46);
  const centerCircleOuterR = Math.round(Math.min(92, Math.max(66, keyW * 0.44)));
  const centerCircleInnerR = Math.round(centerCircleOuterR * 0.38);

  const getArenaPointFromClient = useCallback((clientX: number, clientY: number): Point | null => {
    const arena = arenaRef.current;
    if (!arena) return null;
    const rect = arena.getBoundingClientRect();
    const x = Math.max(20, Math.min(rect.width - 20, clientX - rect.left));
    const y = Math.max(20, Math.min(rect.height - 20, clientY - rect.top));
    return { x, y };
  }, []);

  const getRestCenterPoint = useCallback((): Point | null => {
    if (puckFloorPos) return puckFloorPos;
    const arena = arenaRef.current;
    const rest = puckRestRef.current;
    if (!arena || !rest) return null;
    const arenaRect = arena.getBoundingClientRect();
    const restRect = rest.getBoundingClientRect();
    return {
      x: restRect.left - arenaRect.left + restRect.width / 2,
      y: restRect.top - arenaRect.top + restRect.height / 2,
    };
  }, [puckFloorPos]);

  /**
   * Determine whether a shot from `arenaPoint` is inside the 2-Point arc (2 PT)
   * or beyond the 3-Point line (3 PT) using the exact pixel geometry of the court SVG.
   */
  const getShotPointsFromArenaPoint = useCallback((point?: Point | null): 2 | 3 => {
    if (!point) return 3;
    const arena = arenaRef.current;
    const court = courtRef.current;
    if (!arena || !court) return 3;

    const arenaRect = arena.getBoundingClientRect();
    const courtRect = court.getBoundingClientRect();
    if (courtRect.width <= 0 || courtRect.height <= 0) return 3;

    const px = arenaRect.left + point.x - courtRect.left;
    const py = arenaRect.top + point.y - courtRect.top;

    const w = courtRect.width;
    const h = courtRect.height;
    const cx = w / 2;
    const breakY = h * 0.25;
    const rx = Math.min(w * 0.40, Math.max(230, h * 0.56));
    const ry = h * 0.46;

    if (px < cx - rx || px > cx + rx) return 3;
    if (py <= breakY) return 2;

    const normX = (px - cx) / rx;
    const normY = (py - breakY) / ry;
    return normX * normX + normY * normY <= 1 ? 2 : 3;
  }, []);

  const activeAimPoints: 2 | 3 = aimPoint ? getShotPointsFromArenaPoint(aimPoint) : 3;

  const computeArcFromStartPoint = useCallback((start: Point): ArcGeometry | null => {
    const arena = arenaRef.current;
    const hoop = hoopTargetRef.current;
    if (!arena || !hoop) return null;

    const arenaRect = arena.getBoundingClientRect();
    const hoopRect = hoop.getBoundingClientRect();

    const startX = start.x;
    const startY = start.y;
    // Aim right into the center of the basketball rim
    const endX = hoopRect.left - arenaRect.left + hoopRect.width / 2;
    const endY = hoopRect.top - arenaRect.top + hoopRect.height * 0.56;

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);

    // Ensure the quadratic Bezier apex is always above both the cursor and the hoop
    // so the file arcs up and drops down through the rim like a real basketball shot.
    const highestY = Math.min(startY, endY);
    const arcLift = Math.max(compact ? 48 : 64, Math.min(145, distance * 0.42 + 36));
    const ctrlX = startX + dx * 0.52;
    const ctrlY = Math.max(12, highestY - arcLift);

    const d = `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;

    const dotCount = 11;
    const dots: ArcGeometry['dots'] = [];
    for (let i = 1; i < dotCount; i++) {
      const t = i / dotCount;
      const inv = 1 - t;
      const x = inv * inv * startX + 2 * inv * t * ctrlX + t * t * endX;
      const y = inv * inv * startY + 2 * inv * t * ctrlY + t * t * endY;
      dots.push({
        x,
        y,
        r: Math.max(1.8, 3.6 - t * 1.4),
        opacity: Math.max(0.35, 0.95 - t * 0.45),
      });
    }

    return {
      width: arenaRect.width,
      height: arenaRect.height,
      startX,
      startY,
      ctrlX,
      ctrlY,
      endX,
      endY,
      d,
      dots,
    };
  }, [compact]);

  useEffect(() => {
    if (!isActivelyAiming || !aimPoint) {
      setArcGeometry(null);
      return;
    }
    setArcGeometry(computeArcFromStartPoint(aimPoint));
  }, [isActivelyAiming, aimPoint, computeArcFromStartPoint]);

  useEffect(() => {
    if (disabled || busy || !isBasketballActive) return;
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types || []).includes('Files');

    const handleWindowDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      const arena = arenaRef.current;
      if (!arena) return;
      const rect = arena.getBoundingClientRect();
      // Activate cursor tracking when dragging a file within or near the dropzone card
      const margin = 80;
      const isNearArena =
        event.clientX >= rect.left - margin &&
        event.clientX <= rect.right + margin &&
        event.clientY >= rect.top - margin &&
        event.clientY <= rect.bottom + margin;
      if (!isNearArena) {
        if (isDraggingOver) {
          setIsDraggingOver(false);
          if (!isPointerAiming) {
            setAimPoint(null);
            aimPointRef.current = null;
          }
        }
        return;
      }
      event.preventDefault();
      setIsDraggingOver(true);
      const x = Math.max(20, Math.min(rect.width - 20, event.clientX - rect.left));
      const y = Math.max(20, Math.min(rect.height - 20, event.clientY - rect.top));
      const pt = { x, y };
      aimPointRef.current = pt;
      setAimPoint(pt);
    };

    const handleWindowDragLeave = (event: DragEvent) => {
      if (!event.relatedTarget) {
        setIsDraggingOver(false);
        if (!isPointerAiming) {
          setAimPoint(null);
          aimPointRef.current = null;
        }
      }
    };

    const handleWindowDrop = (event: DragEvent) => {
      setIsDraggingOver(false);
      const releaseQuality = getShotTimingQuality(meterProgressRef.current);
      if (!isPointerAiming) {
        setAimPoint(null);
        aimPointRef.current = null;
      }
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      event.preventDefault();
      const arena = arenaRef.current;
      const dropOrigin = arena ? getArenaPointFromClient(event.clientX, event.clientY) : null;
      handleSelectedFile(files[0], dropOrigin, releaseQuality);
    };

    window.addEventListener('dragover', handleWindowDragOver, true);
    window.addEventListener('dragleave', handleWindowDragLeave, true);
    window.addEventListener('drop', handleWindowDrop, true);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver, true);
      window.removeEventListener('dragleave', handleWindowDragLeave, true);
      window.removeEventListener('drop', handleWindowDrop, true);
    };
  }, [busy, disabled, isDraggingOver, isPointerAiming]);

  const runProgressSimulation = useCallback((file: File) => {
    setActiveFile({ name: file.name, size: file.size });
    setUploadStage('uploading');
    setUploadProgress(16);

    const t1 = window.setTimeout(() => setUploadProgress(56), 140);
    const t2 = window.setTimeout(() => setUploadProgress(88), 300);
    const t3 = window.setTimeout(() => {
      setUploadProgress(100);
      setUploadStage('done');
      setLocalUploadedCount((c) => c + 1);
    }, 460);

    void Promise.resolve(onFileSelect(file)).catch(() => {
      setUploadStage('idle');
    });

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onFileSelect]);

  const triggerHoopSplash = useCallback((points: 2 | 3, quality: ShotTimingQuality = 'excellent') => {
    const key = Date.now();
    setNetSwish(true);
    setShotSplash({ points, quality, key });
    setTotalPoints((prev) => prev + points);
    if (quality === 'excellent') {
      playBasketballSound('greenRelease', soundEnabled);
    }
    playBasketballSound(points === 3 ? 'swish3' : 'swish2', soundEnabled);
    window.setTimeout(() => setNetSwish(false), 560);
    window.setTimeout(() => {
      setShotSplash((current) => (current?.key === key ? null : current));
    }, 1600);
  }, [soundEnabled]);

  const animateShotFromPoint = useCallback((fromPoint?: Point | null, fileToUpload?: File, qualityOverride?: ShotTimingQuality) => {
    const startPoint = fromPoint ?? aimPointRef.current ?? getRestCenterPoint();
    const scoredPoints = getShotPointsFromArenaPoint(startPoint);
    const coords = startPoint ? computeArcFromStartPoint(startPoint) : null;
    const timingQuality = qualityOverride ?? getShotTimingQuality(meterProgressRef.current);
    const feedbackKey = Date.now();
    setReleaseFeedback({
      quality: timingQuality,
      points: scoredPoints,
      key: feedbackKey,
    });
    window.setTimeout(() => {
      setReleaseFeedback((curr) => (curr?.key === feedbackKey ? null : curr));
    }, 2000);

    playBasketballSound('launch', soundEnabled);

    if (!coords) {
      triggerHoopSplash(scoredPoints, timingQuality);
      if (fileToUpload) runProgressSimulation(fileToUpload);
      return;
    }

    if (fileToUpload) {
      pendingFileRef.current = fileToUpload;
    }

    setUploadStage('shooting');

    const isMissed = timingQuality === 'very_early' || timingQuality === 'very_late';
    const isAirball = timingQuality === 'very_early' && meterProgressRef.current < 45;
    const isFrontRim = timingQuality === 'very_early' && meterProgressRef.current >= 45;
    const isBackboard = timingQuality === 'very_late';

    if (!isMissed) {
      // Made shot (Green Sweetspot or Slightly Early / Late)
      const duration = 440;
      const startTime = performance.now();
      const horizontalTilt = Math.max(-28, Math.min(28, (coords.endX - coords.startX) * 0.16));

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const inv = 1 - t;
        const x = inv * inv * coords.startX + 2 * inv * t * coords.ctrlX + t * t * coords.endX;
        const y = inv * inv * coords.startY + 2 * inv * t * coords.ctrlY + t * t * coords.endY;
        const scale = t < 0.45 ? 1 + t * 0.16 : Math.max(0.55, 1.07 - (t - 0.45) * 0.9);
        const rotate = (1 - t) * horizontalTilt;

        setFlightPos({ x, y, scale, rotate });

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setFlightPos(null);
          setPuckFloorPos(null);
          triggerHoopSplash(scoredPoints, timingQuality);

          const targetFile = fileToUpload || pendingFileRef.current;
          if (targetFile) {
            runProgressSimulation(targetFile);
          } else {
            setUploadStage('idle');
            pendingPickAfterShotRef.current = true;
            fileInputRef.current?.click();
          }
        }
      };

      requestAnimationFrame(step);
    } else {
      // MISSED SHOT: Realistic collision & multi-stage floor bounce physics
      let targetX = coords.endX;
      let targetY = coords.endY;

      if (isAirball) {
        targetX = coords.endX;
        targetY = coords.endY + 65;
      } else if (isFrontRim) {
        targetX = coords.endX;
        targetY = coords.endY + 12;
      } else if (isBackboard) {
        targetX = coords.endX + 18;
        targetY = coords.endY - 26;
      }

      const flightDuration = 400;
      const startTime = performance.now();
      const horizontalTilt = Math.max(-28, Math.min(28, (targetX - coords.startX) * 0.16));

      const flyStep = (now: number) => {
        const t = Math.min(1, (now - startTime) / flightDuration);
        const inv = 1 - t;
        const x = inv * inv * coords.startX + 2 * inv * t * coords.ctrlX + t * t * targetX;
        const y = inv * inv * coords.startY + 2 * inv * t * coords.ctrlY + t * t * targetY;
        const scale = t < 0.45 ? 1 + t * 0.16 : Math.max(0.65, 1.07 - (t - 0.45) * 0.8);
        const rotate = (1 - t) * horizontalTilt;

        setFlightPos({ x, y, scale, rotate });

        if (t < 1) {
          requestAnimationFrame(flyStep);
        } else {
          // Impact reached: sound effect
          if (isBackboard) {
            playBasketballSound('backboardThud', soundEnabled);
          } else if (isFrontRim) {
            playBasketballSound('rimClank', soundEnabled);
          } else {
            playBasketballSound('floorBounce', soundEnabled);
          }

          // Stage 2: Floor bounce simulation
          const floorY = (courtSize.height || 640) - 100;
          let curX = targetX;
          let curY = targetY;
          let velX = isBackboard ? 2.4 : isFrontRim ? -1.6 : 0.4;
          let velY = isAirball ? 1.2 : -3.6;
          let curScale = 0.82;
          let curRot = rotate;
          const gravity = 0.55;
          let bounces = 0;

          const bounceStep = () => {
            curX += velX;
            curY += velY;
            velY += gravity;
            curRot += velX * 3;

            if (curY >= floorY) {
              curY = floorY;
              velY = -velY * 0.46; // restitution damping
              velX = velX * 0.65; // friction
              bounces += 1;
              if (Math.abs(velY) > 1.2) {
                playBasketballSound('floorBounce', soundEnabled);
              }
            }

            setFlightPos({ x: curX, y: curY, scale: curScale, rotate: curRot });

            if (bounces < 3 && Math.abs(velY) > 0.8) {
              requestAnimationFrame(bounceStep);
            } else {
              // Settle on the floor without resetting position
              setFlightPos(null);
              setPuckFloorPos({ x: Math.round(curX), y: Math.round(floorY) });
              setUploadStage('idle');
            }
          };

          requestAnimationFrame(bounceStep);
        }
      };

      requestAnimationFrame(flyStep);
    }
  }, [computeArcFromStartPoint, courtSize.height, fileInputRef, getRestCenterPoint, getShotPointsFromArenaPoint, runProgressSimulation, soundEnabled, triggerHoopSplash]);

  const handleSelectedFile = useCallback((file?: File | null, dropOrigin?: Point | null, qualityOverride?: ShotTimingQuality) => {
    if (!file || disabled || busy) return;
    if (!isBasketballActive) {
      runProgressSimulation(file);
      return;
    }
    if (pendingPickAfterShotRef.current) {
      pendingPickAfterShotRef.current = false;
      runProgressSimulation(file);
      return;
    }
    animateShotFromPoint(dropOrigin ?? getRestCenterPoint(), file, qualityOverride);
  }, [animateShotFromPoint, busy, disabled, getRestCenterPoint, isBasketballActive, runProgressSimulation]);

  const updateAimFromClient = useCallback((clientX: number, clientY: number) => {
    const pt = getArenaPointFromClient(clientX, clientY);
    if (!pt) return null;
    aimPointRef.current = pt;
    setAimPoint(pt);
    return pt;
  }, [getArenaPointFromClient]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy || uploadStage === 'shooting') return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPointerAiming(true);
    updateAimFromClient(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerAiming) return;
    updateAimFromClient(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isPointerAiming) return;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const releasePoint = updateAimFromClient(event.clientX, event.clientY) ?? aimPointRef.current;
    const restPoint = getRestCenterPoint();
    const movedDistance = releasePoint && restPoint
      ? Math.hypot(releasePoint.x - restPoint.x, releasePoint.y - restPoint.y)
      : 0;

    const releaseQuality = getShotTimingQuality(meterProgressRef.current);

    setIsPointerAiming(false);
    setAimPoint(null);
    aimPointRef.current = null;

    if (movedDistance >= 14 && releasePoint) {
      animateShotFromPoint(releasePoint, undefined, releaseQuality);
    } else {
      pendingPickAfterShotRef.current = false;
      fileInputRef.current?.click();
    }
  };

  const isUploadingNow = busy || uploadStage === 'uploading';
  const showFileCard = Boolean(displayFile) && (isUploadingNow || uploadStage === 'done' || Boolean(selectedFile));
  const floatingPuckPoint = isBasketballActive
    ? flightPos
      ? { x: flightPos.x, y: flightPos.y, scale: flightPos.scale, rotate: flightPos.rotate }
      : isActivelyAiming && aimPoint
        ? {
            x: aimPoint.x,
            y: aimPoint.y,
            scale: 1.06,
            rotate: arcGeometry ? Math.max(-22, Math.min(22, (arcGeometry.endX - aimPoint.x) * 0.12)) : -8,
          }
        : null
    : null;

  const renderFileCard = () => (
    <div
      onClick={(event) => event.stopPropagation()}
      className="w-full max-w-md rounded-xl border border-border/80 bg-card p-3 text-left shadow-sm animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-300">
            {badgeText}
          </span>
          <span className="truncate text-xs font-semibold text-foreground" title={displayFile?.name}>
            {displayFile?.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">
            {isUploadingNow ? `${Math.min(95, Math.max(25, uploadProgress))}%` : 'Done'}
          </span>
          {onClearFile && !isUploadingNow && (
            <button
              type="button"
              onClick={() => {
                setActiveFile(null);
                setUploadStage('idle');
                onClearFile();
              }}
              aria-label="Hapus file terpilih"
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isUploadingNow ? 'bg-indigo-500' : 'bg-emerald-500'
          )}
          style={{ width: `${isUploadingNow ? Math.max(35, uploadProgress) : 100}%` }}
        />
      </div>

      {/* Status & Size Footer */}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        {isUploadingNow ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <RefreshCw className="size-3 animate-spin text-indigo-500" />
            Uploading file...
          </span>
        ) : (
          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            File uploaded successfully
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatFileSize(displayFile?.size)}
        </span>
      </div>

      {actionButtonLabel && onActionButtonClick && (
        <div className="mt-2.5 flex justify-end gap-2 border-t border-border/60 pt-2">
          <Button
            type="button"
            size="sm"
            disabled={isUploadingNow}
            onClick={onActionButtonClick}
            className="h-7 gap-1.5 px-3 text-xs font-semibold"
          >
            {isUploadingNow ? <RefreshCw className="size-3 animate-spin" /> : <Upload className="size-3" />}
            {actionButtonLabel}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={arenaRef}
      data-basketball-dropzone="true"
      data-basketball-active={isBasketballActive ? 'true' : 'false'}
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled || busy) return;
        setIsDraggingOver(true);
        if (isBasketballActive) updateAimFromClient(event.clientX, event.clientY);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (disabled || busy) return;
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        if (!isDraggingOver) setIsDraggingOver(true);
        if (isBasketballActive) updateAimFromClient(event.clientX, event.clientY);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
        setIsDraggingOver(false);
        if (!isPointerAiming) {
          setAimPoint(null);
          aimPointRef.current = null;
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const dropOrigin = isBasketballActive
          ? (updateAimFromClient(event.clientX, event.clientY) ?? aimPointRef.current)
          : null;
        setIsDraggingOver(false);
        setAimPoint(null);
        aimPointRef.current = null;
        const file = event.dataTransfer?.files?.[0];
        if (file) handleSelectedFile(file, dropOrigin);
      }}
      className={cn(
        'relative select-none overflow-hidden rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 text-foreground shadow-sm transition-colors',
        compact && 'p-3.5',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
    >
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={accept}
        aria-label={inputAriaLabel || title}
        disabled={disabled || busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleSelectedFile(file);
          event.currentTarget.value = '';
        }}
      />

      {/* Top Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[140px] flex-1">
          <p className="text-xs font-bold tracking-tight text-foreground sm:text-sm">{title}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap shrink-0 items-center gap-1.5">
          {isBasketballActive && (
            <>
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                aria-label={soundEnabled ? 'Matikan suara efek basket' : 'Aktifkan suara efek basket'}
                aria-pressed={soundEnabled}
                className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-secondary/50 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {soundEnabled ? <Volume2 className="size-3.5 text-indigo-500" /> : <VolumeX className="size-3.5" />}
              </button>
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-amber-600 dark:text-amber-300">
                {totalPoints} PT
              </span>
            </>
          )}
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-600 dark:text-indigo-300">
            Uploaded {effectiveUploadedCount}
          </span>
        </div>
      </div>

      {/* Full-Card Dashed Court Dropzone (1:1 Pixel-Accurate Pro Half-Court, Extended Vertically) */}
      <div
        ref={courtRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${dropLabel} - ${subtitle}`}
        onClick={() => {
          if (!showFileCard && !disabled && !busy) {
            pendingPickAfterShotRef.current = false;
            fileInputRef.current?.click();
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled && !busy) {
            event.preventDefault();
            pendingPickAfterShotRef.current = false;
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          'relative flex w-full flex-col items-center justify-between overflow-hidden rounded-xl border-2 border-dashed px-4 pb-6 pt-0 text-center transition-all duration-200 focus-visible:outline-2 focus-visible:outline-ring sm:px-6',
          compact ? 'min-h-[520px] pb-5 pt-0' : 'min-h-[640px]',
          isActivelyAiming
            ? 'border-indigo-500 bg-indigo-500/6 shadow-inner'
            : 'border-indigo-400/60 bg-background/70 hover:border-indigo-500/80 hover:bg-background/90 dark:border-indigo-400/45'
        )}
      >
        {/* 1:1 Pixel-Accurate Pro Half-Court SVG Floorplan (Zero Stretching, True Circles, HD Detail) */}
        <svg
          aria-hidden="true"
          width={courtW}
          height={courtH}
          viewBox={`0 0 ${courtW} ${courtH}`}
          shapeRendering="geometricPrecision"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <pattern id={`${inputId}-court-planks`} width="48" height="96" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="96" stroke="rgba(99, 102, 241, 0.055)" strokeWidth="1" />
              <line x1="24" y1="0" x2="24" y2="96" stroke="rgba(99, 102, 241, 0.04)" strokeWidth="1" />
              <line x1="0" y1="48" x2="24" y2="48" stroke="rgba(99, 102, 241, 0.045)" strokeWidth="1" />
              <line x1="24" y1="80" x2="48" y2="80" stroke="rgba(99, 102, 241, 0.045)" strokeWidth="1" />
            </pattern>
            <radialGradient id={`${inputId}-court-spotlight`} cx="50%" cy="28%" r="65%">
              <stop offset="0%" stopColor="rgba(99, 102, 241, 0.11)" />
              <stop offset="60%" stopColor="rgba(99, 102, 241, 0.03)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
            </radialGradient>
            <linearGradient id={`${inputId}-paint-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(79, 70, 229, 0.14)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0.06)" />
            </linearGradient>
          </defs>

          {/* Subtle Hardwood Plank Texture + Arena Spotlight */}
          <rect x="0" y="0" width={courtW} height={courtH} fill={`url(#${inputId}-court-planks)`} />
          <rect
            x="0"
            y="0"
            width={courtW}
            height={courtH}
            fill={
              isActivelyAiming && activeAimPoints === 3
                ? 'rgba(245, 158, 11, 0.065)'
                : `url(#${inputId}-court-spotlight)`
            }
          />

          {/* Sideline Coach's Box & Half-Court Hash Ticks */}
          <path
            d={`M 0 ${Math.round(courtH * 0.34)} L 14 ${Math.round(courtH * 0.34)} M 0 ${Math.round(courtH * 0.68)} L 14 ${Math.round(courtH * 0.68)} M ${courtW - 14} ${Math.round(courtH * 0.34)} L ${courtW} ${Math.round(courtH * 0.34)} M ${courtW - 14} ${Math.round(courtH * 0.68)} L ${courtW} ${Math.round(courtH * 0.68)}`}
            stroke="rgba(99, 102, 241, 0.35)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* 2-Point Interior Zone (Inside 3-Point Arc) — Soft Outer Glow + Crisp Dashed Arc */}
          <path
            d={`M ${courtCx - arcRx} 0 L ${courtCx - arcRx} ${cornerBreakY} A ${arcRx} ${arcRy} 0 0 0 ${courtCx + arcRx} ${cornerBreakY} L ${courtCx + arcRx} 0 Z`}
            fill={
              isActivelyAiming && activeAimPoints === 2
                ? 'rgba(16, 185, 129, 0.11)'
                : 'rgba(99, 102, 241, 0.045)'
            }
            stroke={
              isActivelyAiming && activeAimPoints === 2
                ? 'rgba(16, 185, 129, 0.24)'
                : isActivelyAiming && activeAimPoints === 3
                  ? 'rgba(245, 158, 11, 0.24)'
                  : 'rgba(99, 102, 241, 0.14)'
            }
            strokeWidth="7"
          />
          <path
            d={`M ${courtCx - arcRx} 0 L ${courtCx - arcRx} ${cornerBreakY} A ${arcRx} ${arcRy} 0 0 0 ${courtCx + arcRx} ${cornerBreakY} L ${courtCx + arcRx} 0`}
            fill="none"
            stroke={
              isActivelyAiming && activeAimPoints === 2
                ? '#10B981'
                : isActivelyAiming && activeAimPoints === 3
                  ? '#F59E0B'
                  : 'rgba(99, 102, 241, 0.58)'
            }
            strokeWidth="2.5"
            strokeDasharray="10 7"
            strokeLinecap="round"
          />

          {/* The Paint / Free-Throw Key (Pro Double-Border + Gradient Fill) */}
          <rect
            x={keyLeft}
            y="0"
            width={keyW}
            height={freeThrowY}
            fill={`url(#${inputId}-paint-fill)`}
            stroke="rgba(79, 70, 229, 0.48)"
            strokeWidth="2.2"
          />
          <rect
            x={keyLeft + 6}
            y="0"
            width={keyW - 12}
            height={freeThrowY - 6}
            fill="none"
            stroke="rgba(99, 102, 241, 0.2)"
            strokeWidth="1"
          />

          {/* Pro Lane Blocks & Hash Marks Along Key */}
          <rect x={keyLeft - 12} y={Math.round(freeThrowY * 0.36)} width="12" height="10" rx="1.5" fill="rgba(79, 70, 229, 0.38)" />
          <rect x={keyRight} y={Math.round(freeThrowY * 0.36)} width="12" height="10" rx="1.5" fill="rgba(79, 70, 229, 0.38)" />
          <path
            d={[0.54, 0.70, 0.86]
              .map((ratio) => {
                const y = Math.round(freeThrowY * ratio);
                return `M ${keyLeft - 10} ${y} L ${keyLeft} ${y} M ${keyRight} ${y} L ${keyRight + 10} ${y}`;
              })
              .join(' ')}
            stroke="rgba(79, 70, 229, 0.48)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* True Circular Free-Throw Circle (Bottom Solid Half + Top Dashed Half) */}
          <path
            d={`M ${courtCx - ftRadius} ${freeThrowY} A ${ftRadius} ${ftRadius} 0 0 0 ${courtCx + ftRadius} ${freeThrowY}`}
            fill="rgba(99, 102, 241, 0.04)"
            stroke="rgba(79, 70, 229, 0.5)"
            strokeWidth="2.2"
          />
          <path
            d={`M ${courtCx - ftRadius} ${freeThrowY} A ${ftRadius} ${ftRadius} 0 0 1 ${courtCx + ftRadius} ${freeThrowY}`}
            fill="none"
            stroke="rgba(79, 70, 229, 0.36)"
            strokeWidth="1.8"
            strokeDasharray="6 6"
          />

          {/* True Circular Restricted Area Arc under Basket */}
          <path
            d={`M ${courtCx - restrictedRadius} 0 L ${courtCx - restrictedRadius} ${restrictedBreakY} A ${restrictedRadius} ${restrictedRadius} 0 0 0 ${courtCx + restrictedRadius} ${restrictedBreakY} L ${courtCx + restrictedRadius} 0`}
            fill="rgba(79, 70, 229, 0.05)"
            stroke="rgba(79, 70, 229, 0.42)"
            strokeWidth="2"
          />

          {/* True Circular Bottom Half-Court Center Circle & Inner Jump Circle */}
          <path
            d={`M ${courtCx - centerCircleOuterR} ${courtH} A ${centerCircleOuterR} ${centerCircleOuterR} 0 0 1 ${courtCx + centerCircleOuterR} ${courtH}`}
            fill="rgba(99, 102, 241, 0.04)"
            stroke="rgba(79, 70, 229, 0.44)"
            strokeWidth="2.2"
          />
          <path
            d={`M ${courtCx - centerCircleInnerR} ${courtH} A ${centerCircleInnerR} ${centerCircleInnerR} 0 0 1 ${courtCx + centerCircleInnerR} ${courtH}`}
            fill="rgba(79, 70, 229, 0.08)"
            stroke="rgba(79, 70, 229, 0.38)"
            strokeWidth="1.8"
          />
        </svg>

        {/* Crisp Unstretched HTML Court Markings (2 PT ZONE & 3 PT) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
          {/* Left Wing 3 PT Badge */}
          <span
            className={cn(
              'absolute left-[4%] top-[44%] -translate-y-1/2 rounded-full border px-3.5 py-1 text-xs font-extrabold tracking-wider shadow-2xs transition-colors sm:left-[5%]',
              isActivelyAiming && activeAimPoints === 3
                ? 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-300'
                : 'border-indigo-500/35 bg-indigo-500/10 text-indigo-600/85 dark:text-indigo-300/85'
            )}
          >
            3 PT
          </span>

          {/* Right Wing 3 PT Badge */}
          <span
            className={cn(
              'absolute right-[4%] top-[44%] -translate-y-1/2 rounded-full border px-3.5 py-1 text-xs font-extrabold tracking-wider shadow-2xs transition-colors sm:right-[5%]',
              isActivelyAiming && activeAimPoints === 3
                ? 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-300'
                : 'border-indigo-500/35 bg-indigo-500/10 text-indigo-600/85 dark:text-indigo-300/85'
            )}
          >
            3 PT
          </span>

          {/* Center 2 PT ZONE Badge (Inside 3-Point Arc below Free-Throw Circle) */}
          <span
            className={cn(
              'absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border px-4 py-1 text-xs font-extrabold tracking-wider shadow-2xs transition-colors',
              isActivelyAiming && activeAimPoints === 2
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                : 'border-indigo-500/40 bg-indigo-500/12 text-indigo-600 dark:text-indigo-300'
            )}
          >
            2 PT ZONE
          </span>

          {/* Left & Right 3 PT LINE Labels along the lower arc */}
          <span
            className={cn(
              'absolute left-[22%] top-[73%] -translate-x-1/2 -translate-y-1/2 text-[11px] font-extrabold tracking-widest transition-colors',
              isActivelyAiming && activeAimPoints === 3
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-indigo-500/75 dark:text-indigo-300/75'
            )}
          >
            3 PT LINE
          </span>
          <span
            className={cn(
              'absolute right-[22%] top-[73%] translate-x-1/2 -translate-y-1/2 text-[11px] font-extrabold tracking-widest transition-colors',
              isActivelyAiming && activeAimPoints === 3
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-indigo-500/75 dark:text-indigo-300/75'
            )}
          >
            3 PT LINE
          </span>
        </div>

        {/* Ultra-HD Pro Arena Backboard, Metallic Breakaway Rim & 12-Loop Diamond-Weave Net (Mounted Flush to Top Dashed Border) */}
        <div
          ref={hoopTargetRef}
          aria-hidden="true"
          className="pointer-events-none relative z-10 -mt-1.5 flex items-center justify-center"
        >
          {/* 2K Release Timing Result at the Hoop ("EXCELLENT", "SLIGHTLY EARLY", "SLIGHTLY LATE", etc.) */}
          {releaseFeedback && (
            <div
              key={releaseFeedback.key}
              data-testid="hoop-release-feedback"
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 z-30 animate-in fade-in zoom-in-90 slide-in-from-bottom-2 duration-150"
            >
              <span
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1 font-mono text-xs font-black tracking-wider text-white shadow-xl backdrop-blur-md transition-all',
                  releaseFeedback.quality === 'excellent'
                    ? 'bg-emerald-500 shadow-emerald-500/70 ring-2 ring-emerald-300 animate-pulse'
                    : releaseFeedback.quality === 'slightly_early' || releaseFeedback.quality === 'slightly_late'
                    ? 'bg-amber-500 shadow-amber-500/50 ring-1 ring-amber-300'
                    : 'bg-rose-600 shadow-rose-600/50 ring-1 ring-rose-400'
                )}
              >
                {releaseFeedback.quality === 'excellent'
                  ? 'EXCELLENT'
                  : releaseFeedback.quality === 'slightly_early'
                  ? 'SLIGHTLY EARLY'
                  : releaseFeedback.quality === 'slightly_late'
                  ? 'SLIGHTLY LATE'
                  : releaseFeedback.quality === 'very_early'
                  ? 'VERY EARLY'
                  : 'VERY LATE'}
              </span>
            </div>
          )}

          {/* Splash Celebration Burst when File Enters the Hoop */}
          {shotSplash && (
            <div
              key={shotSplash.key}
              data-testid="hoop-splash-indicator"
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            >
              {/* Expanding Ripple Ring */}
              <span
                className={cn(
                  'absolute top-12 size-24 animate-ping rounded-full border-2 opacity-60',
                  shotSplash.points === 3 ? 'border-amber-400 bg-amber-400/15' : 'border-emerald-400 bg-emerald-400/15'
                )}
              />
              {/* Radial Splash Droplets SVG */}
              <svg
                width="176"
                height="134"
                viewBox="0 0 140 110"
                className="absolute top-3 overflow-visible animate-in zoom-in-75 fade-in duration-200"
              >
                {[
                  { cx: 24, cy: 32, r: 4.2 },
                  { cx: 38, cy: 16, r: 3.2 },
                  { cx: 70, cy: 10, r: 4.8 },
                  { cx: 102, cy: 16, r: 3.2 },
                  { cx: 116, cy: 32, r: 4.2 },
                  { cx: 18, cy: 56, r: 3.2 },
                  { cx: 122, cy: 56, r: 3.2 },
                  { cx: 48, cy: 76, r: 3 },
                  { cx: 92, cy: 76, r: 3 },
                ].map((drop, i) => (
                  <circle
                    key={i}
                    cx={drop.cx}
                    cy={drop.cy}
                    r={drop.r}
                    fill={shotSplash.points === 3 ? '#F59E0B' : '#10B981'}
                  />
                ))}
                <path
                  d="M 42 46 L 22 28 M 55 38 L 44 16 M 85 38 L 96 16 M 98 46 L 118 28"
                  stroke={shotSplash.points === 3 ? '#F59E0B' : '#10B981'}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
              {/* Floating +2 PT / +3 PT Splash Banner with 2K Feedback */}
              <div
                className={cn(
                  'relative top-3 flex items-center gap-1.5 rounded-full border px-4 py-1 text-xs font-extrabold tracking-wide text-white shadow-lg animate-in fade-in zoom-in-90 duration-200',
                  shotSplash.quality === 'excellent'
                    ? 'border-emerald-300 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 shadow-emerald-500/50 ring-2 ring-emerald-400'
                    : shotSplash.points === 3
                    ? 'border-amber-300 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 shadow-amber-500/30'
                    : 'border-emerald-300 bg-gradient-to-r from-emerald-500 to-indigo-600 shadow-emerald-500/30'
                )}
              >
                <span>
                  {shotSplash.quality === 'excellent'
                    ? `EXCELLENT RELEASE! +${shotSplash.points} PT`
                    : shotSplash.quality === 'slightly_early'
                    ? `SLIGHTLY EARLY (+${shotSplash.points} PT)`
                    : shotSplash.quality === 'slightly_late'
                    ? `SLIGHTLY LATE (+${shotSplash.points} PT)`
                    : `SPLASH! +${shotSplash.points} PT`}
                </span>
              </div>
            </div>
          )}

          <svg
            width={compact ? 138 : 162}
            height={compact ? 118 : 138}
            viewBox="0 0 160 136"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="geometricPrecision"
            className="overflow-visible drop-shadow-md"
          >
            <defs>
              <linearGradient id={`${inputId}-glass-grad`} x1="16" y1="6" x2="144" y2="78" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.96)" />
                <stop offset="52%" stopColor="rgba(241, 245, 249, 0.92)" />
                <stop offset="100%" stopColor="rgba(224, 231, 255, 0.9)" />
              </linearGradient>
              <linearGradient id={`${inputId}-rim-grad`} x1="42" y1="70" x2="118" y2="82" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="50%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#3730A3" />
              </linearGradient>
              <linearGradient id={`${inputId}-net-cord`} x1="80" y1="76" x2="80" y2="128" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4338CA" />
                <stop offset="55%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>
            </defs>

            {/* Backboard Drop Shadow & Outer Pro Frame */}
            <rect
              x="16"
              y="6"
              width="128"
              height="74"
              rx="10"
              fill={`url(#${inputId}-glass-grad)`}
              stroke="#94A3B8"
              strokeWidth="2.4"
            />
            {/* Inner Tempered Glass Bezel */}
            <rect
              x="21"
              y="11"
              width="118"
              height="64"
              rx="6"
              stroke="rgba(99, 102, 241, 0.25)"
              strokeWidth="1.4"
            />

            {/* Diagonal Tempered Glass Specular Reflection Sheen */}
            <path
              d="M 30 12 L 56 12 L 34 74 L 22 74 Z M 64 12 L 74 12 L 52 74 L 42 74 Z"
              fill="rgba(255, 255, 255, 0.55)"
            />

            {/* Corner Structural Mounting Brackets & Bolts */}
            {[
              { x: 25, y: 15 },
              { x: 135, y: 15 },
              { x: 25, y: 69 },
              { x: 135, y: 69 },
            ].map((b, idx) => (
              <g key={idx}>
                <circle cx={b.x} cy={b.y} r="3" fill="#CBD5E1" stroke="#64748B" strokeWidth="1" />
                <circle cx={b.x} cy={b.y} r="1.1" fill="#475569" />
              </g>
            ))}

            {/* Shooter's Square Target Box */}
            <rect
              x="54"
              y="28"
              width="52"
              height="36"
              rx="3"
              stroke={isActivelyAiming ? '#4F46E5' : '#64748B'}
              strokeWidth="2.4"
              fill={isActivelyAiming ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.35)'}
            />
            {/* Shooter's Square Target Corner Accents */}
            <path
              d="M 58 36 L 58 32 L 62 32 M 102 36 L 102 32 L 98 32 M 58 56 L 58 60 L 62 60 M 102 56 L 102 60 L 98 60"
              stroke="#4F46E5"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Heavy-Duty Breakaway Rim Mounting Plate & Collar */}
            <rect x="70" y="63" width="20" height="10" rx="2" fill="#312E81" stroke="#4338CA" strokeWidth="1.2" />
            <circle cx="74" cy="68" r="1.3" fill="#A5B4FC" />
            <circle cx="86" cy="68" r="1.3" fill="#A5B4FC" />

            {/* Back Half of Rim */}
            <path
              d="M 43 75 A 37 6.5 0 0 1 117 75"
              stroke="#3730A3"
              strokeWidth="4.2"
              strokeLinecap="round"
            />

            {/* 12-Loop Diamond-Weave Pro Nylon Net */}
            <g
              className="origin-top transition-transform duration-300"
              style={{
                transformOrigin: '80px 76px',
                transform: netSwish ? 'scaleY(1.26) scaleX(0.88)' : 'scaleY(1) scaleX(1)',
              }}
            >
              {/* Outer Net Silhouette Contour */}
              <path
                d="M 45 76 C 48 94, 53 112, 56 126 M 115 76 C 112 94, 107 112, 104 126"
                stroke={`url(#${inputId}-net-cord)`}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Diagonal Right-Slanting Net Cords */}
              <path
                d="M 46 76 L 64 126 M 55 76 L 74 126 M 65 76 L 84 126 M 75 76 L 94 126 M 86 76 L 103 126 M 97 76 L 108 108 M 107 76 L 112 92"
                stroke={`url(#${inputId}-net-cord)`}
                strokeWidth="1.85"
                strokeLinecap="round"
              />
              {/* Diagonal Left-Slanting Net Cords */}
              <path
                d="M 114 76 L 96 126 M 105 76 L 86 126 M 95 76 L 76 126 M 85 76 L 66 126 M 74 76 L 57 126 M 63 76 L 52 108 M 53 76 L 48 92"
                stroke={`url(#${inputId}-net-cord)`}
                strokeWidth="1.85"
                strokeLinecap="round"
              />
              {/* Horizontal Net Weave Tiers */}
              <path
                d="M 48 89 Q 80 96 112 89 M 51 102 Q 80 109 109 102 M 54 115 Q 80 121 106 115 M 56 126 Q 80 130 104 126"
                stroke="#4F46E5"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeOpacity="0.9"
              />
              {/* Net Knot Highlights */}
              {[60, 70, 80, 90, 100].map((kx) => (
                <circle key={`k1-${kx}`} cx={kx} cy={92} r="1.4" fill="#E0E7FF" />
              ))}
              {[62, 71, 80, 89, 98].map((kx) => (
                <circle key={`k2-${kx}`} cx={kx} cy={105} r="1.4" fill="#E0E7FF" />
              ))}
              {[64, 72, 80, 88, 96].map((kx) => (
                <circle key={`k3-${kx}`} cx={kx} cy={117} r="1.3" fill="#E0E7FF" />
              ))}
            </g>

            {/* Front Half of Pro Rim with Metallic Gradient & Specular Highlight */}
            <ellipse
              cx="80"
              cy="75"
              rx="37"
              ry="6.5"
              stroke={shotSplash?.quality === 'excellent' ? '#10B981' : `url(#${inputId}-rim-grad)`}
              strokeWidth={shotSplash?.quality === 'excellent' ? '5.6' : '4.6'}
              fill="none"
              style={{
                filter: shotSplash?.quality === 'excellent' ? 'drop-shadow(0 0 16px #10B981)' : undefined,
              }}
            />
            <path
              d="M 46 77 A 35 5.5 0 0 0 114 77"
              stroke="#A5B4FC"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
            {/* Rim Net Hooks */}
            {[48, 56, 64, 72, 80, 88, 96, 104, 112].map((hx) => (
              <circle key={`hook-${hx}`} cx={hx} cy={79.5} r="1.2" fill="#312E81" />
            ))}
          </svg>
        </div>

        {/* Drop Files Here Prompt / Uploaded File Status (Positioned Below the Hoop) */}
        <div className="relative z-10 mb-auto mt-2 flex w-full flex-col items-center">
          {!showFileCard ? (
            <div className="pointer-events-none flex flex-col items-center gap-1 rounded-xl border border-indigo-500/15 bg-background/85 px-5 py-2 shadow-2xs backdrop-blur-[3px]">
              <div className="mb-0.5 flex size-8 items-center justify-center rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-300">
                <Upload className="size-4" />
              </div>
              <p className="text-xs font-semibold text-foreground sm:text-sm">{dropLabel}</p>
              <p className="text-[11px] text-muted-foreground">
                {helperText || 'or take the shot'}
              </p>
              {helperBadges && helperBadges.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                  {helperBadges.map((ext) => (
                    <span
                      key={ext}
                      className="rounded border border-border/70 bg-secondary/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground"
                    >
                      {ext.startsWith('.') ? ext : `.${ext}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            renderFileCard()
          )}
        </div>

        {/* Slingshot Launch Pad in Deep 3-PT Court (inside dashed dropzone) */}
        <div className={cn('relative z-10 flex flex-col items-center justify-end gap-2', compact && 'gap-1.5')}>
          <div
            ref={puckRestRef}
            className={cn(
              puckFloorPos ? 'absolute z-30' : 'relative flex h-18 items-center justify-center'
            )}
            style={
              puckFloorPos
                ? {
                    left: `${puckFloorPos.x}px`,
                    top: `${puckFloorPos.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }
                : undefined
            }
          >
            <button
              type="button"
              disabled={disabled || busy}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(event) => event.stopPropagation()}
              aria-label="Tarik file ke mana saja lalu lepas untuk menembak ke ring basket, atau klik untuk pilih file"
              style={{
                opacity: floatingPuckPoint ? 0 : 1,
              }}
              className="group relative flex h-16 w-14 cursor-grab touch-none items-center justify-center rounded-xl transition-transform duration-150 hover:scale-105 active:cursor-grabbing"
            >
              <svg
                width="56"
                height="66"
                viewBox="0 0 56 66"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                shapeRendering="geometricPrecision"
                className="overflow-visible drop-shadow-md transition-all group-hover:drop-shadow-lg"
              >
                {/* Document Card Body */}
                <path
                  d="M 6 8 C 6 4.686 8.686 2 12 2 H 36 L 50 16 V 58 C 50 61.314 47.314 64 44 64 H 12 C 8.686 64 6 61.314 6 58 V 8 Z"
                  className="fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700"
                  strokeWidth="1.8"
                />
                {/* Folded 3D Corner */}
                <path
                  d="M 36 2 V 12 C 36 14.209 37.791 16 40 16 H 50 L 36 2 Z"
                  className="fill-indigo-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-700"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                {/* Crisp Document Content Preview Lines */}
                <rect x="13" y="14" width="16" height="3" rx="1.5" fill="rgba(99, 102, 241, 0.28)" />
                <rect x="13" y="21" width="28" height="2.5" rx="1.25" fill="rgba(148, 163, 184, 0.45)" />
                <rect x="13" y="27" width="24" height="2.5" rx="1.25" fill="rgba(148, 163, 184, 0.4)" />
                <rect x="13" y="33" width="20" height="2.5" rx="1.25" fill="rgba(148, 163, 184, 0.35)" />
                {/* Extension Pill Badge */}
                <rect x="11" y="42" width="34" height="15" rx="4.5" fill="#4F46E5" />
                <text
                  x="28"
                  y="52.5"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9.5"
                  fontWeight="800"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                  letterSpacing="0.05em"
                >
                  {badgeText}
                </text>
              </svg>
            </button>

            {/* Subtle Inline Upload Chip when resting on court floor after a miss */}
            {puckFloorPos && !floatingPuckPoint && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const file = pendingFileRef.current;
                  setPuckFloorPos(null);
                  if (file) {
                    runProgressSimulation(file);
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/80 bg-background/95 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-foreground shadow-md backdrop-blur-sm transition hover:bg-secondary flex items-center gap-1 active:scale-95 z-30"
              >
                <Upload className="size-2.5 text-emerald-500" />
                <span>Unggah</span>
              </button>
            )}
          </div>

          <p className="pointer-events-none rounded-full bg-background/80 px-3 py-0.5 text-center text-[11px] font-medium text-muted-foreground backdrop-blur-[2px]">
            {isActivelyAiming
              ? `Release to shoot for ${activeAimPoints} PT!`
              : 'Aim the file inside (2 PT) or outside the arc (3 PT) & release to shoot'}
          </p>
        </div>
      </div>

      {/* Live Dotted Trajectory Prediction Arc from Cursor to Basketball Hoop */}
      {isActivelyAiming && arcGeometry && (() => {
        const isMeterGreen = meterProgress >= 82 && meterProgress <= 92;
        const isMeterYellow = (meterProgress >= 70 && meterProgress < 82) || (meterProgress > 92 && meterProgress <= 98);
        const arcColor = isMeterGreen ? '#10B981' : isMeterYellow ? '#F59E0B' : '#EF4444';
        const arcGlowColor = isMeterGreen ? '#34D399' : isMeterYellow ? '#FBBF24' : '#F87171';

        return (
          <svg
            aria-hidden="true"
            width={arcGeometry.width}
            height={arcGeometry.height}
            shapeRendering="geometricPrecision"
            className="pointer-events-none absolute inset-0 z-20 overflow-visible"
          >
            {/* Soft glow guide path */}
            <path
              d={arcGeometry.d}
              fill="none"
              stroke={arcGlowColor}
              strokeOpacity={isMeterGreen ? 0.45 : 0.25}
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            {/* Dashed prediction curve */}
            <path
              d={arcGeometry.d}
              fill="none"
              stroke={arcColor}
              strokeWidth="2.8"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
            {/* Trajectory prediction dots along the curve */}
            {arcGeometry.dots.map((dot, idx) => (
              <circle
                key={idx}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={arcColor}
                fillOpacity={dot.opacity}
              />
            ))}
            {/* Hoop target ring */}
            <circle
              cx={arcGeometry.endX}
              cy={arcGeometry.endY}
              r="7.5"
              fill={arcGlowColor}
              fillOpacity="0.25"
              stroke={arcColor}
              strokeWidth="2"
            />
            <circle
              cx={arcGeometry.endX}
              cy={arcGeometry.endY}
              r="3"
              fill={arcColor}
            />
          </svg>
        );
      })()}

      {/* Cursor-following / Flying HD File Puck */}
      {floatingPuckPoint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-30"
          style={{
            transform: `translate(${floatingPuckPoint.x - 28}px, ${floatingPuckPoint.y - 33}px) scale(${floatingPuckPoint.scale}) rotate(${floatingPuckPoint.rotate}deg)`,
          }}
        >
          {isActivelyAiming && (
            <>
              {/* NBA 2K Vertical Shot Meter Gauge attached to Player / Document Puck */}
              <ShotMeterGauge
                progress={meterProgress}
                visible={isActivelyAiming}
                className="absolute -top-[90px] left-1/2 -translate-x-1/2"
              />
              <span
                className={cn(
                  'absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-white shadow-md',
                  activeAimPoints === 3 ? 'bg-amber-500' : 'bg-emerald-600'
                )}
              >
                {activeAimPoints} PT
              </span>
            </>
          )}
          <svg
            width="56"
            height="66"
            viewBox="0 0 56 66"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            shapeRendering="geometricPrecision"
            className="overflow-visible drop-shadow-xl"
          >
            <path
              d="M 6 8 C 6 4.686 8.686 2 12 2 H 36 L 50 16 V 58 C 50 61.314 47.314 64 44 64 H 12 C 8.686 64 6 61.314 6 58 V 8 Z"
              className="fill-white stroke-indigo-500 dark:fill-slate-900 dark:stroke-indigo-400"
              strokeWidth="2.2"
            />
            <path
              d="M 36 2 V 12 C 36 14.209 37.791 16 40 16 H 50 L 36 2 Z"
              className="fill-indigo-100 stroke-indigo-500 dark:fill-slate-800 dark:stroke-indigo-400"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <rect x="13" y="14" width="16" height="3" rx="1.5" fill="rgba(99, 102, 241, 0.35)" />
            <rect x="13" y="21" width="28" height="2.5" rx="1.25" fill="rgba(148, 163, 184, 0.5)" />
            <rect x="13" y="27" width="24" height="2.5" rx="1.25" fill="rgba(148, 163, 184, 0.45)" />
            <rect x="13" y="33" width="20" height="2.5" rx="1.25" fill="rgba(148, 163, 184, 0.4)" />
            <rect x="11" y="42" width="34" height="15" rx="4.5" fill="#4F46E5" />
            <text
              x="28"
              y="52.5"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="9.5"
              fontWeight="800"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
              letterSpacing="0.05em"
            >
              {badgeText}
            </text>
          </svg>
        </div>
      )}
    </div>
  );
}
