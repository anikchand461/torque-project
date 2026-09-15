"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

interface InfoTooltipProps {
  text: string;
}

const BUBBLE_WIDTH = 210;
const VIEWPORT_MARGIN = 8;

/**
 * A compact "i" bubble that reveals an explanation on
 * hover/focus.
 *
 * The bubble is rendered through a portal into
 * document.body, positioned with `position: fixed` from
 * the trigger icon's actual on-screen coordinates. This is
 * intentional, not a stylistic choice: the modals this is
 * used inside have `overflow: hidden` (for their rounded
 * corners), and CSS alone cannot make an absolutely-
 * positioned descendant escape a clipping ancestor —
 * increasing z-index does not help, since overflow clipping
 * happens independently of stacking order. Portaling out of
 * that ancestor entirely is the only reliable fix, while the
 * visible trigger ("i" icon) and the bubble's own look stay
 * exactly the same.
 */
export default function InfoTooltip({
  text,
}: InfoTooltipProps) {
  const triggerRef =
    useRef<HTMLSpanElement>(null);

  const [position, setPosition] =
    useState<{
      top: number;
      left: number;
      showBelow: boolean;
    } | null>(null);

  const show = useCallback(() => {
    const rect =
      triggerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    // Keep the bubble within the viewport
    // horizontally, so it stays readable even
    // when the icon sits near the left/right
    // edge of a modal.
    let left =
      rect.left +
      rect.width / 2 -
      BUBBLE_WIDTH / 2;

    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(
        left,
        window.innerWidth -
          BUBBLE_WIDTH -
          VIEWPORT_MARGIN,
      ),
    );

    // If the icon is close to the top of the
    // viewport, showing the bubble above it
    // could push it off-screen — show it below
    // instead in that case.
    const showBelow = rect.top < 100;

    setPosition({
      top: showBelow
        ? rect.bottom + 8
        : rect.top - 8,
      left,
      showBelow,
    });
  }, []);

  const hide = useCallback(() => {
    setPosition(null);
  }, []);

  return (
    <span
      ref={triggerRef}
      className="info-tooltip"
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        className="info-tooltip-icon"
        aria-hidden="true"
      >
        i
      </span>

      <span className="sr-only">
        {text}
      </span>

      {position &&
        typeof document !==
          "undefined" &&
        createPortal(
          <span
            className="info-tooltip-bubble"
            role="tooltip"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: BUBBLE_WIDTH,
              transform: position.showBelow
                ? undefined
                : "translateY(-100%)",
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
