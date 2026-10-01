import React from "react";
import { LEVEL_COLOR, LEVEL_TEXT, type Level } from "../theme/colors";
import { LevelIcon } from "./LevelIcon";

/** Status: color + shape + text (never color alone). */
export const StatusPill = ({ level, text, icon }: { level: Level; text: string; icon?: string }) => (
  <span className="ff-pill" style={{ background: LEVEL_COLOR[level], color: LEVEL_TEXT[level] }}>
    <LevelIcon level={level} icon={icon} color={LEVEL_TEXT[level]} />
    {text}
  </span>
);
