import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface ObstacleEvent {
    id: string;
    type: string;
    confidenceLevel: number;
    timestamp: Time;
    associatedDetectionId: string;
    image: ExternalBlob;
    position: {
        x: number;
        y: number;
    };
    riskLevel: {
        description: string;
        level: string;
    };
    potholeDetails?: PotholeDetails;
    classification: Classification;
}
export type Time = bigint;
export interface Classification {
    motion: MotionType;
    objectType: ObjectType;
}
export interface PotholeDetails {
    potholeType: PotholeType;
    image_url: string;
    distance_from_vehicle: number;
    createdAt: Time;
    size: number;
    severity: string;
    depth: number;
    location: {
        coordinates: [number, number];
        accuracy: number;
    };
}
export interface UserProfile {
    name: string;
}
export enum MotionType {
    static_ = "static",
    moving = "moving"
}
export enum ObjectType {
    pedestrian = "pedestrian",
    debris = "debris",
    vehicle = "vehicle",
    unknown_ = "unknown"
}
export enum PotholeType {
    deep = "deep",
    edge = "edge",
    pavement = "pavement",
    complex = "complex",
    rough_size = "rough_size",
    surface_cracks = "surface_cracks",
    unknown_ = "unknown"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addPotholeSpecificEvent(id: string, position: {
        x: number;
        y: number;
    }, confidenceLevel: number, timestamp: Time, associatedDetectionId: string, image: ExternalBlob, riskLevel: {
        description: string;
        level: string;
    }, potholeDetails: PotholeDetails): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAllObstacleEvents(): Promise<Array<ObstacleEvent>>;
    getAllPotholeEvents(): Promise<Array<ObstacleEvent>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getObstacleEvent(id: string): Promise<ObstacleEvent>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    storeObstacleEvent(id: string, position: {
        x: number;
        y: number;
    }, type: string, confidenceLevel: number, timestamp: Time, associatedDetectionId: string, image: ExternalBlob, riskLevel: {
        description: string;
        level: string;
    }, classification: Classification, potholeDetails: PotholeDetails | null): Promise<void>;
}
