import { useRef } from 'react'
import { Button, type ButtonProps } from '@tarojs/components'

// H5 taps must not depend on Chrome synthesizing a click after a drag.
// A scrolling gesture never activates; its compatibility click is deduplicated.
// WeChat retains its native tap/click path.
export function TouchButton({
  className = '',
  disabled,
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  ...props
}: ButtonProps) {
  const touch = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const activated = useRef(0)
  return (
    <Button
      {...{ role: 'button', tabIndex: disabled ? -1 : 0 }}
      {...props}
      aria-disabled={!!disabled}
      disabled={disabled || undefined}
      className={'game-button ' + className}
      onClick={(event) => {
        if (!disabled && Date.now() - activated.current > 650) onClick?.(event)
      }}
      onTouchStart={(event) => {
        const p = event.touches[0]
        if (process.env.TARO_ENV === 'h5' && p)
          touch.current = { x: p.clientX, y: p.clientY, moved: false }
        onTouchStart?.(event)
      }}
      onTouchMove={(event) => {
        const p = event.touches[0]
        if (
          touch.current &&
          p &&
          Math.hypot(p.clientX - touch.current.x, p.clientY - touch.current.y) >
            8
        )
          touch.current.moved = true
        onTouchMove?.(event)
      }}
      onTouchEnd={(event) => {
        const start = touch.current,
          p = event.changedTouches[0]
        touch.current = null
        if (
          process.env.TARO_ENV === 'h5' &&
          start &&
          p &&
          !start.moved &&
          Math.hypot(p.clientX - start.x, p.clientY - start.y) <= 8 &&
          !disabled
        ) {
          event.preventDefault()
          activated.current = Date.now()
          onClick?.(event)
        }
        onTouchEnd?.(event)
      }}
      onTouchCancel={(event) => {
        touch.current = null
        onTouchCancel?.(event)
      }}
    />
  )
}
