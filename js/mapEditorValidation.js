// js/mapEditorValidation.js
// Validates and normalizes documents entering the Map Editor.

/** @param {unknown} value @returns {value is Record<string, any>} */
const isRecord = value =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const isFiniteNumber = value =>
    typeof value === 'number' && Number.isFinite(value);

function validatePoint(point, label) {
    if (!isRecord(point)) return `${label} must be an object.`;
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
        return `${label} must have finite numeric x and y coordinates.`;
    }
    return null;
}

/**
 * Validate a map document before it enters the editor or is saved.
 * Unknown fields are preserved so editor documents can evolve without data loss.
 *
 * @param {unknown} input
 * @returns {{valid: true, mapData: Record<string, any>} | {valid: false, error: string}}
 */
export function normalizeMapEditorDocument(input) {
    if (!isRecord(input)) {
        return { valid: false, error: 'Map document must be a JSON object.' };
    }

    let sourcePaths;
    if (Array.isArray(input.paths)) {
        sourcePaths = input.paths;
    } else if (input.paths === undefined && Array.isArray(input.waypoints)) {
        // Older maps stored one path directly as a top-level waypoints array.
        sourcePaths = [{ waypoints: input.waypoints }];
    } else {
        return { valid: false, error: 'Map document must contain a paths array.' };
    }

    const paths = [];
    for (let pathIndex = 0; pathIndex < sourcePaths.length; pathIndex++) {
        const path = sourcePaths[pathIndex];
        const pathLabel = `Path ${pathIndex + 1}`;
        if (!isRecord(path)) {
            return { valid: false, error: `${pathLabel} must be an object.` };
        }
        if (!Array.isArray(path.waypoints)) {
            return { valid: false, error: `${pathLabel} must contain a waypoints array.` };
        }
        if (path.width !== undefined && (!isFiniteNumber(path.width) || path.width <= 0)) {
            return { valid: false, error: `${pathLabel} width must be a positive finite number.` };
        }
        if (path.visible !== undefined && typeof path.visible !== 'boolean') {
            return { valid: false, error: `${pathLabel} visibility must be a boolean.` };
        }

        const waypoints = [];
        for (let pointIndex = 0; pointIndex < path.waypoints.length; pointIndex++) {
            const point = path.waypoints[pointIndex];
            const pointLabel = `${pathLabel} waypoint ${pointIndex + 1}`;
            const pointError = validatePoint(point, pointLabel);
            if (pointError) return { valid: false, error: pointError };

            if (point.curve) {
                if (pointIndex === 0) {
                    return { valid: false, error: `${pointLabel} cannot define a curve before the first segment.` };
                }
                if (!isRecord(point.curve)
                    || !isFiniteNumber(point.curve.cx)
                    || !isFiniteNumber(point.curve.cy)) {
                    return {
                        valid: false,
                        error: `${pointLabel} curve must have finite numeric cx and cy coordinates.`
                    };
                }
            }
            waypoints.push({
                ...point,
                ...(point.curve && { curve: { ...point.curve } })
            });
        }
        paths.push({ ...path, waypoints });
    }

    const sourceProps = input.props === undefined ? [] : input.props;
    if (!Array.isArray(sourceProps)) {
        return { valid: false, error: 'Map props must be an array.' };
    }
    const props = [];
    for (let index = 0; index < sourceProps.length; index++) {
        const prop = sourceProps[index];
        const label = `Prop ${index + 1}`;
        if (!isRecord(prop)) return { valid: false, error: `${label} must be an object.` };
        const pointError = validatePoint(prop, label);
        if (pointError) return { valid: false, error: pointError };
        if (prop.type !== undefined && typeof prop.type !== 'string') {
            return { valid: false, error: `${label} type must be a string.` };
        }
        if (prop.shape !== undefined && typeof prop.shape !== 'string') {
            return { valid: false, error: `${label} shape must be a string.` };
        }
        for (const dimension of ['r', 'w', 'h']) {
            if (prop[dimension] !== undefined
                && (!isFiniteNumber(prop[dimension]) || prop[dimension] <= 0)) {
                return {
                    valid: false,
                    error: `${label} ${dimension} must be a positive finite number.`
                };
            }
        }
        props.push({ ...prop });
    }

    const sourceWaterBrushes = input.waterBrushes === undefined ? [] : input.waterBrushes;
    if (!Array.isArray(sourceWaterBrushes)) {
        return { valid: false, error: 'Map waterBrushes must be an array.' };
    }
    const waterBrushes = [];
    for (let brushIndex = 0; brushIndex < sourceWaterBrushes.length; brushIndex++) {
        const brush = sourceWaterBrushes[brushIndex];
        const label = `Water brush ${brushIndex + 1}`;
        if (!isRecord(brush)) return { valid: false, error: `${label} must be an object.` };
        if (!Array.isArray(brush.points)) {
            return { valid: false, error: `${label} must contain a points array.` };
        }
        if (!isFiniteNumber(brush.thickness) || brush.thickness <= 0) {
            return { valid: false, error: `${label} thickness must be a positive finite number.` };
        }
        if (brush.color !== undefined && typeof brush.color !== 'string') {
            return { valid: false, error: `${label} color must be a string.` };
        }
        const points = [];
        for (let pointIndex = 0; pointIndex < brush.points.length; pointIndex++) {
            const pointError = validatePoint(
                brush.points[pointIndex],
                `${label} point ${pointIndex + 1}`
            );
            if (pointError) return { valid: false, error: pointError };
            points.push({ ...brush.points[pointIndex] });
        }
        waterBrushes.push({ ...brush, points });
    }

    if (input.name !== undefined && typeof input.name !== 'string') {
        return { valid: false, error: 'Map name must be a string.' };
    }
    for (const field of ['image', 'imageNight']) {
        if (input[field] !== undefined && input[field] !== null && typeof input[field] !== 'string') {
            return { valid: false, error: `Map ${field} must be a string or null.` };
        }
    }
    for (const field of ['imageScale', 'imageOffsetX', 'imageOffsetY']) {
        if (input[field] !== undefined && !isFiniteNumber(input[field])) {
            return { valid: false, error: `Map ${field} must be a finite number.` };
        }
    }
    for (const field of ['imageMaintainRatio', 'waterVisible', 'propsVisible']) {
        if (input[field] !== undefined && typeof input[field] !== 'boolean') {
            return { valid: false, error: `Map ${field} must be a boolean.` };
        }
    }

    /** @type {Record<string, any>} */
    const mapData = { ...input, paths, props, waterBrushes };
    delete mapData.waypoints;
    return { valid: true, mapData };
}
