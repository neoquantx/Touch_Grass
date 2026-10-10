export function isVeryDark(exif) {
  if (!exif) return false;
  
  const iso = exif.ISOSpeedRatings ?? exif.PhotographicSensitivity;
  const exposure = exif.ExposureTime;
  
  if (iso !== undefined && exposure !== undefined) {
    if (iso >= 1600 && exposure >= 0.03) {
      return true;
    }
  }
  
  if (exif.BrightnessValue !== undefined) {
    if (exif.BrightnessValue < -3) {
      return true;
    }
  }
  
  return false;
}
