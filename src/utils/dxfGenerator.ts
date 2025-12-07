import { BedData } from '../services/api.service';

interface DxfOptions {
    exportType: 'detailed' | 'summary';
}

export function generateDxfContent(
    bedData: BedData[],
    clusters: Record<string, number[]>,
    options: DxfOptions
): string {
    const lines: string[] = [];

    // Helper to add DXF group code and value
    const add = (code: number, value: string | number) => {
        lines.push(`${code}`);
        lines.push(`${value}`);
    };

    // Header
    add(0, 'SECTION');
    add(2, 'HEADER');
    add(9, '$ACADVER');
    add(1, 'AC1015'); // AutoCAD 2000
    add(0, 'ENDSEC');

    // Tables (Layers)
    add(0, 'SECTION');
    add(2, 'TABLES');
    add(0, 'TABLE');
    add(2, 'LAYER');

    // Add layers for each cluster
    Object.keys(clusters).forEach((clusterId, index) => {
        add(0, 'LAYER');
        add(100, 'AcDbSymbolTableRecord');
        add(100, 'AcDbLayerTableRecord');
        add(2, `cluster_${clusterId}`);
        add(70, 0);
        add(62, (index % 255) + 1); // Color
        add(6, 'CONTINUOUS');
    });

    add(0, 'ENDTAB');
    add(0, 'ENDSEC');

    // Entities
    add(0, 'SECTION');
    add(2, 'ENTITIES');

    // Map beds to clusters for easy lookup
    const bedToCluster = new Map<number, string>();
    Object.entries(clusters).forEach(([clusterId, bedIndices]) => {
        bedIndices.forEach(idx => {
            // Assuming bed_data index matches usage in clusters
            if (bedData[idx]) {
                bedToCluster.set(bedData[idx].bed_id, clusterId);
            }
        });
    });

    bedData.forEach((bed, index) => {
        if (!bed.polygons || bed.polygons.length === 0) return;

        // Find cluster for this bed
        // Note: clusters mapping uses indices into the bedData array
        let clusterId = '0';
        Object.entries(clusters).forEach(([cId, indices]) => {
            if (indices.includes(index)) {
                clusterId = cId;
            }
        });

        const layerName = `cluster_${clusterId}`;

        bed.polygons.forEach(polygon => {
            if (polygon.length < 2) return;

            add(0, 'LWPOLYLINE');
            add(100, 'AcDbEntity');
            add(8, layerName);
            add(100, 'AcDbPolyline');
            add(90, polygon.length); // Number of vertices
            add(70, 1); // Closed polyline flag

            polygon.forEach(point => {
                add(10, point[0]); // X
                add(20, point[1]); // Y
            });
        });
    });

    add(0, 'ENDSEC');
    add(0, 'EOF');

    return lines.join('\n');
}
