import { pointInPolygon, type LatLng } from "./geo";

export interface ResolverBranch {
  id: number;
  name: string;
  active: boolean;
  deliveryEnabled: boolean;
  lat: number | null;
  lng: number | null;
}

export interface ResolverZone {
  id: number;
  branchId: number | null;
  enabled: boolean;
  sortOrder: number;
  polygon: unknown;
}

type ValidResolverZone = Omit<ResolverZone, "polygon"> & { polygon: LatLng[] };

export type BranchExclusionReason =
  | "inactive_branch"
  | "delivery_disabled"
  | "missing_coordinates"
  | "no_matching_zone";

export interface BranchExclusion {
  branchId: number;
  reason: BranchExclusionReason;
}

export interface EligibleBranch {
  id: number;
  name: string;
  distanceKm: number;
  matchingZoneId: number;
}

export type BranchResolverOutcome =
  | "selected"
  | "no_active_delivery_branches"
  | "no_eligible_branch_coordinates"
  | "outside_delivery_zones";

export interface BranchResolution {
  selectedBranchId: number | null;
  selectedBranchName: string | null;
  distanceKm: number | null;
  matchingZoneId: number | null;
  eligibleBranches: EligibleBranch[];
  exclusions: BranchExclusion[];
  outcome: BranchResolverOutcome;
}

export type CoordinateValidation =
  | { ok: true; point: LatLng }
  | { ok: false; error: string };

function isValidPolygon(polygon: unknown): polygon is LatLng[] {
  return Array.isArray(polygon)
    && polygon.length >= 3
    && polygon.every((vertex): vertex is LatLng =>
      typeof vertex === "object"
      && vertex !== null
      && "lat" in vertex
      && "lng" in vertex
      && typeof vertex.lat === "number"
      && typeof vertex.lng === "number"
      && Number.isFinite(vertex.lat)
      && Number.isFinite(vertex.lng)
      && vertex.lat >= -90
      && vertex.lat <= 90
      && vertex.lng >= -180
      && vertex.lng <= 180);
}

function roundDistance(distanceKm: number): number {
  return Number(distanceKm.toFixed(6));
}

export function haversineKm(from: LatLng, to: LatLng): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateResolveCoordinates(latValue: unknown, lngValue: unknown): CoordinateValidation {
  const parse = (value: unknown, name: "lat" | "lng"): number | string => {
    if (typeof value !== "string" && typeof value !== "number") return `${name} is required`;
    if (typeof value === "string" && value.trim() === "") return `${name} is required`;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) return `${name} must be a finite number`;
    return number;
  };
  const lat = parse(latValue, "lat");
  if (typeof lat === "string") return { ok: false, error: lat };
  const lng = parse(lngValue, "lng");
  if (typeof lng === "string") return { ok: false, error: lng };
  if (lat < -90 || lat > 90) return { ok: false, error: "lat must be between -90 and 90" };
  if (lng < -180 || lng > 180) return { ok: false, error: "lng must be between -180 and 180" };
  return { ok: true, point: { lat, lng } };
}

export function resolveNearestBranch(
  point: LatLng,
  branches: readonly ResolverBranch[],
  zones: readonly ResolverZone[],
): BranchResolution {
  const zonesByBranch = new Map<number, ValidResolverZone[]>();
  for (const zone of zones) {
    if (zone.enabled !== true || zone.branchId === null || !isValidPolygon(zone.polygon)) continue;
    const branchZones = zonesByBranch.get(zone.branchId) ?? [];
    branchZones.push({ ...zone, polygon: zone.polygon });
    zonesByBranch.set(zone.branchId, branchZones);
  }
  for (const branchZones of zonesByBranch.values()) {
    branchZones.sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
  }

  const eligibleCandidates: Array<EligibleBranch & { rawDistanceKm: number }> = [];
  const exclusions: BranchExclusion[] = [];
  let hasActiveDeliveryBranch = false;
  let hasCoordinateEligibleBranch = false;
  const seenBranchIds = new Set<number>();

  for (const branch of [...branches].sort((left, right) => left.id - right.id)) {
    if (seenBranchIds.has(branch.id)) continue;
    seenBranchIds.add(branch.id);
    if (branch.active !== true) {
      exclusions.push({ branchId: branch.id, reason: "inactive_branch" });
      continue;
    }
    if (branch.deliveryEnabled !== true) {
      exclusions.push({ branchId: branch.id, reason: "delivery_disabled" });
      continue;
    }
    hasActiveDeliveryBranch = true;
    const branchLat = branch.lat;
    const branchLng = branch.lng;
    if (branchLat === null
      || branchLng === null
      || !Number.isFinite(branchLat)
      || !Number.isFinite(branchLng)
      || branchLat < -90
      || branchLat > 90
      || branchLng < -180
      || branchLng > 180) {
      exclusions.push({ branchId: branch.id, reason: "missing_coordinates" });
      continue;
    }
    hasCoordinateEligibleBranch = true;
    const matchingZone = (zonesByBranch.get(branch.id) ?? [])
      .find((zone) => pointInPolygon(point, zone.polygon));
    if (!matchingZone) {
      exclusions.push({ branchId: branch.id, reason: "no_matching_zone" });
      continue;
    }
    const rawDistanceKm = haversineKm(point, { lat: branchLat, lng: branchLng });
    eligibleCandidates.push({
      id: branch.id,
      name: branch.name,
      distanceKm: roundDistance(rawDistanceKm),
      matchingZoneId: matchingZone.id,
      rawDistanceKm,
    });
  }

  eligibleCandidates.sort((left, right) => left.rawDistanceKm - right.rawDistanceKm || left.id - right.id);
  const eligibleBranches = eligibleCandidates.map(({ rawDistanceKm: _rawDistanceKm, ...branch }) => branch);
  const selected = eligibleBranches[0];
  const outcome: BranchResolverOutcome = selected
    ? "selected"
    : !hasActiveDeliveryBranch
      ? "no_active_delivery_branches"
      : !hasCoordinateEligibleBranch
        ? "no_eligible_branch_coordinates"
        : "outside_delivery_zones";

  return {
    selectedBranchId: selected?.id ?? null,
    selectedBranchName: selected?.name ?? null,
    distanceKm: selected?.distanceKm ?? null,
    matchingZoneId: selected?.matchingZoneId ?? null,
    eligibleBranches,
    exclusions,
    outcome,
  };
}