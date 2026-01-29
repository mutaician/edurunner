import {
    Mesh,
    MeshBuilder,
    Scene,
    Color3,
    PBRMaterial,
    GlowLayer,
    TransformNode
} from '@babylonjs/core';

interface TrackSegment {
    parent: TransformNode;
    floor: Mesh;
    leftEdge: Mesh;
    rightEdge: Mesh;
    laneMarkers: Mesh[];
}

export class Track {
    private segments: TrackSegment[] = [];
    private readonly segmentLength: number = 30; // Reasonable segment length
    private readonly totalSegments: number = 20; // Plenty of segments for coverage
    private readonly trackWidth: number = 9;
    private readonly laneWidth: number = 3;
    private speed: number = 12; // Default comfortable speed
    private readonly minSpeed: number = 6; // Minimum speed
    private readonly maxSpeed: number = 42; // Maximum speed
    private readonly speedStep: number = 2; // Speed change per key press
    private scene: Scene;
    private glowLayer: GlowLayer;
    
    // Materials
    private floorMaterial!: PBRMaterial;
    private edgeMaterial!: PBRMaterial;
    private laneMarkerMaterial!: PBRMaterial;

    constructor(scene: Scene, glowLayer: GlowLayer) {
        this.scene = scene;
        this.glowLayer = glowLayer;
        this.createMaterials();
        this.createTrack();
    }

    private createMaterials(): void {
        // Main floor - dark with subtle metallic sheen
        this.floorMaterial = new PBRMaterial("floorMat", this.scene);
        this.floorMaterial.albedoColor = new Color3(0.08, 0.08, 0.12);
        this.floorMaterial.metallic = 0.3;
        this.floorMaterial.roughness = 0.7;
        this.floorMaterial.emissiveColor = new Color3(0.02, 0.02, 0.04);

        // Edge rails - softer cyan glow
        this.edgeMaterial = new PBRMaterial("edgeMat", this.scene);
        this.edgeMaterial.albedoColor = new Color3(0, 0.5, 0.6);
        this.edgeMaterial.emissiveColor = new Color3(0, 0.3, 0.4);
        this.edgeMaterial.metallic = 0.7;
        this.edgeMaterial.roughness = 0.4;

        // Lane markers - very subtle purple
        this.laneMarkerMaterial = new PBRMaterial("laneMat", this.scene);
        this.laneMarkerMaterial.albedoColor = new Color3(0.4, 0.15, 0.6);
        this.laneMarkerMaterial.emissiveColor = new Color3(0.15, 0.05, 0.25);
        this.laneMarkerMaterial.metallic = 0.3;
        this.laneMarkerMaterial.roughness = 0.6;
        this.laneMarkerMaterial.alpha = 0.6;
    }

    private createTrack(): void {
        // Create track segments from behind the player extending forward
        // Player is at Z=5, camera around Z=-5
        for (let i = 0; i < this.totalSegments; i++) {
            const segment = this.createSegment(i);
            // Start from Z=-50 (behind camera) and extend forward
            segment.parent.position.z = -50 + (i * this.segmentLength);
            this.segments.push(segment);
        }
    }

    private createSegment(index: number): TrackSegment {
        const parent = new TransformNode(`segment_${index}`, this.scene);

        // Main floor panel
        const floor = MeshBuilder.CreateBox(`floor_${index}`, {
            width: this.trackWidth,
            height: 0.15,
            depth: this.segmentLength
        }, this.scene);
        floor.material = this.floorMaterial;
        floor.position.y = -0.075;
        floor.parent = parent;

        // Create glowing edge rails
        const edgeHeight = 0.4;
        const edgeWidth = 0.15;

        const leftEdge = MeshBuilder.CreateBox(`leftEdge_${index}`, {
            width: edgeWidth,
            height: edgeHeight,
            depth: this.segmentLength
        }, this.scene);
        leftEdge.position.x = -this.trackWidth / 2 - edgeWidth / 2;
        leftEdge.position.y = edgeHeight / 2 - 0.1;
        leftEdge.material = this.edgeMaterial;
        leftEdge.parent = parent;
        this.glowLayer.addIncludedOnlyMesh(leftEdge);

        const rightEdge = MeshBuilder.CreateBox(`rightEdge_${index}`, {
            width: edgeWidth,
            height: edgeHeight,
            depth: this.segmentLength
        }, this.scene);
        rightEdge.position.x = this.trackWidth / 2 + edgeWidth / 2;
        rightEdge.position.y = edgeHeight / 2 - 0.1;
        rightEdge.material = this.edgeMaterial;
        rightEdge.parent = parent;
        this.glowLayer.addIncludedOnlyMesh(rightEdge);

        // Create lane divider markers (dashed lines between lanes)
        const laneMarkers: Mesh[] = [];
        const markerLength = 4;
        const markerGap = 2;
        const markersPerSegment = Math.floor(this.segmentLength / (markerLength + markerGap));

        // Two lane dividers (between left-center and center-right)
        const lanePositions = [-this.laneWidth, this.laneWidth];

        for (const laneX of lanePositions) {
            for (let m = 0; m < markersPerSegment; m++) {
                const marker = MeshBuilder.CreateBox(`marker_${index}_${m}`, {
                    width: 0.1,
                    height: 0.02,
                    depth: markerLength
                }, this.scene);
                marker.position.x = laneX;
                marker.position.y = 0.01;
                marker.position.z = -this.segmentLength / 2 + markerLength / 2 + m * (markerLength + markerGap) + 1;
                marker.material = this.laneMarkerMaterial;
                marker.parent = parent;
                laneMarkers.push(marker);
                this.glowLayer.addIncludedOnlyMesh(marker);
            }
        }

        // Add subtle center lane indicator (different pattern)
        const centerMarkers = this.createCenterLaneAccents(index, parent);
        laneMarkers.push(...centerMarkers);

        return { parent, floor, leftEdge, rightEdge, laneMarkers };
    }

    private createCenterLaneAccents(index: number, parent: TransformNode): Mesh[] {
        const accents: Mesh[] = [];
        const accentMaterial = new PBRMaterial(`accentMat_${index}`, this.scene);
        accentMaterial.albedoColor = new Color3(0, 0.6, 0.8);
        accentMaterial.emissiveColor = new Color3(0, 0.3, 0.5);
        accentMaterial.alpha = 0.6;

        // Small dots along the edges of the track for extra detail
        const dotSpacing = 5;
        const dotsPerSegment = Math.floor(this.segmentLength / dotSpacing);

        for (let d = 0; d < dotsPerSegment; d++) {
            // Left side dots
            const leftDot = MeshBuilder.CreateCylinder(`dotL_${index}_${d}`, {
                diameter: 0.2,
                height: 0.05
            }, this.scene);
            leftDot.position.x = -this.trackWidth / 2 + 0.3;
            leftDot.position.y = 0.025;
            leftDot.position.z = -this.segmentLength / 2 + d * dotSpacing + 2;
            leftDot.material = accentMaterial;
            leftDot.parent = parent;
            accents.push(leftDot);
            this.glowLayer.addIncludedOnlyMesh(leftDot);

            // Right side dots
            const rightDot = MeshBuilder.CreateCylinder(`dotR_${index}_${d}`, {
                diameter: 0.2,
                height: 0.05
            }, this.scene);
            rightDot.position.x = this.trackWidth / 2 - 0.3;
            rightDot.position.y = 0.025;
            rightDot.position.z = -this.segmentLength / 2 + d * dotSpacing + 2;
            rightDot.material = accentMaterial;
            rightDot.parent = parent;
            accents.push(rightDot);
            this.glowLayer.addIncludedOnlyMesh(rightDot);
        }

        return accents;
    }

    public update(deltaTime: number): void {
        const moveDistance = this.speed * (deltaTime / 1000);

        for (const segment of this.segments) {
            segment.parent.position.z -= moveDistance;

            // Recycle segment when it goes behind camera (camera ~Z=-5)
            if (segment.parent.position.z < -60) {
                // Find the furthest forward segment
                let maxZ = -Infinity;
                for (const s of this.segments) {
                    if (s.parent.position.z > maxZ) maxZ = s.parent.position.z;
                }
                // Place this segment at the end
                segment.parent.position.z = maxZ + this.segmentLength;
            }
        }
    }

    public getSpeed(): number {
        return this.speed;
    }

    public setSpeed(speed: number): void {
        this.speed = Math.max(this.minSpeed, Math.min(this.maxSpeed, speed));
    }

    public increaseSpeed(): void {
        this.setSpeed(this.speed + this.speedStep);
    }

    public decreaseSpeed(): void {
        this.setSpeed(this.speed - this.speedStep);
    }

    public getSpeedLimits(): { min: number; max: number; current: number } {
        return { min: this.minSpeed, max: this.maxSpeed, current: this.speed };
    }

    public getLanePositions(): number[] {
        return [-this.laneWidth, 0, this.laneWidth];
    }
}
