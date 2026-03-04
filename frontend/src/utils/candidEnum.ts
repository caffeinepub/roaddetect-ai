import { ObjectType, MotionType } from '@/backend';

/**
 * Utility functions to safely compare and normalize Candid enum/variant values
 * from the backend with TypeScript enum types.
 */

/**
 * Checks if an ObjectType matches a specific type string.
 * Handles both enum values and potential variant representations.
 */
export function isObjectType(objectType: ObjectType, type: 'vehicle' | 'pedestrian' | 'debris' | 'unknown'): boolean {
  // Handle enum comparison - compare against the enum string values
  if (typeof objectType === 'string') {
    return objectType === type;
  }
  
  // Handle potential variant object representation (e.g., { vehicle: null })
  if (typeof objectType === 'object' && objectType !== null) {
    // Check both the type name and the enum key (e.g., 'unknown_' for 'unknown')
    const enumKey = type === 'unknown' ? 'unknown_' : type;
    return type in objectType || enumKey in objectType;
  }
  
  return false;
}

/**
 * Checks if a MotionType matches a specific motion string.
 * Handles both enum values and potential variant representations.
 */
export function isMotionType(motionType: MotionType, motion: 'static' | 'moving'): boolean {
  // Handle enum comparison - compare against the enum string values
  if (typeof motionType === 'string') {
    return motionType === motion;
  }
  
  // Handle potential variant object representation (e.g., { moving: null })
  if (typeof motionType === 'object' && motionType !== null) {
    // Check both the motion name and the enum key (e.g., 'static_' for 'static')
    const enumKey = motion === 'static' ? 'static_' : motion;
    return motion in motionType || enumKey in motionType;
  }
  
  return false;
}

/**
 * Normalizes an ObjectType to a readable string.
 */
export function objectTypeToString(objectType: ObjectType): string {
  if (typeof objectType === 'string') {
    // The enum values are already the correct strings ("vehicle", "pedestrian", "debris", "unknown")
    return objectType;
  }
  
  if (typeof objectType === 'object' && objectType !== null) {
    const keys = Object.keys(objectType);
    if (keys.length > 0) {
      const key = keys[0];
      // Map enum key to display string
      return key === 'unknown_' ? 'unknown' : key;
    }
  }
  
  return 'unknown';
}

/**
 * Normalizes a MotionType to a readable string.
 */
export function motionTypeToString(motionType: MotionType): string {
  if (typeof motionType === 'string') {
    // The enum values are already the correct strings ("static", "moving")
    return motionType;
  }
  
  if (typeof motionType === 'object' && motionType !== null) {
    const keys = Object.keys(motionType);
    if (keys.length > 0) {
      const key = keys[0];
      // Map enum key to display string
      return key === 'static_' ? 'static' : key;
    }
  }
  
  return 'static';
}
