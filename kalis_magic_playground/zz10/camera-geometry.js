/** Source rectangle visible through a centered CSS object-fit: cover video. */
export function coverGeometry(videoWidth, videoHeight, viewWidth, viewHeight, maxSampleSide = 480) {
  const values = [videoWidth, videoHeight, viewWidth, viewHeight, maxSampleSide];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;

  const viewAspect = viewWidth / viewHeight;
  const videoAspect = videoWidth / videoHeight;
  const sourceWidth = videoAspect > viewAspect ? videoHeight * viewAspect : videoWidth;
  const sourceHeight = videoAspect > viewAspect ? videoHeight : videoWidth / viewAspect;
  const sourceX = (videoWidth - sourceWidth) / 2;
  const sourceY = (videoHeight - sourceHeight) / 2;
  const sampleScale = Math.min(1, maxSampleSide / Math.max(viewWidth, viewHeight));
  const sampleWidth = Math.max(1, Math.round(viewWidth * sampleScale));
  const sampleHeight = Math.max(1, Math.round(viewHeight * sampleScale));

  return {
    sourceX, sourceY, sourceWidth, sourceHeight,
    sampleWidth, sampleHeight, viewWidth, viewHeight,
  };
}

/** Analysis coordinates to the exact visible stage rectangle. */
export function samplePointToView(point, geometry) {
  return {
    x: point.x * geometry.viewWidth / geometry.sampleWidth,
    y: point.y * geometry.viewHeight / geometry.sampleHeight,
  };
}
