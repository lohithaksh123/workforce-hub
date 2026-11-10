'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Crop, ZoomIn, ZoomOut, Move, Loader2, X } from 'lucide-react'

interface ImageCropperModalProps {
    isOpen: boolean
    onClose: () => void
    imageSrc: string | null
    onCropComplete: (croppedBlob: Blob) => void
    isUploading?: boolean
}

export function ImageCropperModal({
    isOpen,
    onClose,
    imageSrc,
    onCropComplete,
    isUploading = false,
}: ImageCropperModalProps) {
    const [zoom, setZoom] = useState<number>(1.0)
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
    const [imgLoaded, setImgLoaded] = useState<boolean>(false)

    const imgRef = useRef<HTMLImageElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    // Constants for container and crop circle
    const CONTAINER_SIZE = 288 // w-72
    const CROP_SIZE = 256 // w-64
    const OFFSET_BORDER = (CONTAINER_SIZE - CROP_SIZE) / 2 // 16px

    // Reset state on image change and manage body scroll locking
    useEffect(() => {
        if (isOpen) {
            setZoom(1.0)
            setOffset({ x: 0, y: 0 })
            setImgLoaded(false)
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [imageSrc, isOpen])

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget
        const natW = img.naturalWidth
        const natH = img.naturalHeight

        // Fit image so its smaller dimension is CROP_SIZE
        let fitW = CROP_SIZE
        let fitH = CROP_SIZE

        if (natW > natH) {
            fitW = (natW * CROP_SIZE) / natH
        } else {
            fitH = (natH * CROP_SIZE) / natW
        }

        setImgDimensions({ width: fitW, height: fitH })
        setImgLoaded(true)
    }

    // Helper to get bounded offset
    const getConstrainedOffset = (x: number, y: number, zoomVal: number) => {
        if (!imgLoaded) return { x: 0, y: 0 }

        const wCurr = imgDimensions.width * zoomVal
        const hCurr = imgDimensions.height * zoomVal

        const xCenter = (CONTAINER_SIZE - wCurr) / 2
        const yCenter = (CONTAINER_SIZE - hCurr) / 2

        // Bounded boundaries
        const minX = CROP_SIZE + OFFSET_BORDER - xCenter - wCurr
        const maxX = OFFSET_BORDER - xCenter
        const minY = CROP_SIZE + OFFSET_BORDER - yCenter - hCurr
        const maxY = OFFSET_BORDER - yCenter

        return {
            x: Math.max(minX, Math.min(maxX, x)),
            y: Math.max(minY, Math.min(maxY, y)),
        }
    }

    // Constrain offset when zoom changes
    useEffect(() => {
        if (imgLoaded) {
            setOffset((prev) => getConstrainedOffset(prev.x, prev.y, zoom))
        }
    }, [zoom, imgLoaded])

    // Drag handlers
    const startDrag = (clientX: number, clientY: number) => {
        setIsDragging(true)
        setDragStart({ x: clientX - offset.x, y: clientY - offset.y })
    }

    const moveDrag = (clientX: number, clientY: number) => {
        if (!isDragging) return
        const rawX = clientX - dragStart.x
        const rawY = clientY - dragStart.y
        setOffset(getConstrainedOffset(rawX, rawY, zoom))
    }

    const endDrag = () => {
        setIsDragging(false)
    }

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        startDrag(e.clientX, e.clientY)
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        moveDrag(e.clientX, e.clientY)
    }

    // Touch events
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY)
        }
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            moveDrag(e.touches[0].clientX, e.touches[0].clientY)
        }
    }

    // Canvas cropping
    const handleCrop = () => {
        if (!imgRef.current || !imgLoaded) return

        const img = imgRef.current
        const wCurr = imgDimensions.width * zoom
        const hCurr = imgDimensions.height * zoom

        const xCenter = (CONTAINER_SIZE - wCurr) / 2
        const yCenter = (CONTAINER_SIZE - hCurr) / 2

        const x = xCenter + offset.x
        const y = yCenter + offset.y

        // Coordinates of the crop area in container space
        const cropX = OFFSET_BORDER - x
        const cropY = OFFSET_BORDER - y

        // Map back to natural scale
        const ratio = img.naturalWidth / wCurr
        const sx = cropX * ratio
        const sy = cropY * ratio
        const sw = CROP_SIZE * ratio
        const sh = CROP_SIZE * ratio

        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 400
        const ctx = canvas.getContext('2d')

        if (ctx) {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 400, 400)
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        onCropComplete(blob)
                    }
                },
                'image/jpeg',
                0.95
            )
        }
    }

    // Listen to mouseup globally to avoid drag sticking
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDragging) endDrag()
        }
        window.addEventListener('mouseup', handleGlobalMouseUp)
        window.addEventListener('touchend', handleGlobalMouseUp)
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp)
            window.removeEventListener('touchend', handleGlobalMouseUp)
        }
    }, [isDragging])

    const handleZoomChange = (val: number[]) => {
        setZoom(val[0])
    }

    if (!isOpen) return null

    const wCurr = imgDimensions.width * zoom
    const hCurr = imgDimensions.height * zoom
    const xCenter = (CONTAINER_SIZE - wCurr) / 2
    const yCenter = (CONTAINER_SIZE - hCurr) / 2
    const leftPos = xCenter + offset.x
    const topPos = yCenter + offset.y

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity">
            <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl w-full max-w-md relative flex flex-col gap-6 max-h-[95vh] overflow-y-auto">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    disabled={isUploading}
                    className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                {/* Header */}
                <div className="space-y-1 pr-6">
                    <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <Crop className="h-5 w-5 text-primary" />
                        Crop Profile Photo
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                        Drag the photo to center it inside the circle, and use the slider to zoom.
                    </p>
                </div>

                {/* Crop Area Container */}
                <div className="flex flex-col items-center gap-6 my-2 select-none">
                    <div
                        ref={containerRef}
                        className="w-72 h-72 overflow-hidden relative bg-slate-950 rounded-3xl border border-slate-800 shadow-inner cursor-move"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                    >
                        {imageSrc && (
                            <img
                                ref={imgRef}
                                src={imageSrc}
                                alt="Crop Target"
                                onLoad={handleImageLoad}
                                className="absolute pointer-events-none max-w-none"
                                style={{
                                    width: `${wCurr}px`,
                                    height: `${hCurr}px`,
                                    left: `${leftPos}px`,
                                    top: `${topPos}px`,
                                }}
                            />
                        )}

                        {/* Circular Mask Overlay */}
                        <div className="absolute inset-4 rounded-full border-2 border-white/50 pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.75)] z-10" />

                        {/* Centered Guide indicator */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-0">
                            <Move className="h-8 w-8 text-white" />
                        </div>
                    </div>

                    {/* Zoom Slider */}
                    <div className="w-full flex items-center gap-3 px-2">
                        <ZoomOut className="h-4 w-4 text-slate-400" />
                        <Slider
                            value={[zoom]}
                            onValueChange={handleZoomChange}
                            min={1.0}
                            max={3.0}
                            step={0.02}
                            disabled={!imgLoaded || isUploading}
                            className="flex-1"
                        />
                        <ZoomIn className="h-4 w-4 text-slate-400" />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4 mt-1">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isUploading}
                        className="font-bold text-slate-300 hover:text-white hover:bg-slate-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCrop}
                        disabled={!imgLoaded || isUploading}
                        className="bg-primary hover:bg-primary/90 text-white font-bold gap-2 px-6 shadow-md"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Crop className="h-4 w-4" />
                                Crop & Save
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
