import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup } from "@/design-system/components/ListRow";
import { Input } from "@/design-system/components/Input";
import { Button } from "@/design-system/components/Button";
import { useT } from "@/core/i18n";
import { authClient } from "@/lib/auth-client";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  type MyProfile,
} from "@/app/_actions/profile-actions";
import { Avatar } from "@/app/_components/profile-sheet/ProfileSheet";
import { haptics } from "@/lib/haptics";

export {
  React,
  useCallback,
  useEffect,
  useRef,
  useState,
  Camera,
  ModalSheet,
  ListGroup,
  Input,
  Button,
  useT,
  authClient,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  removeMyAvatar,
  Avatar,
  haptics,
};

export type { MyProfile };
