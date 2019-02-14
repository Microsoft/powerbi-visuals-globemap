import * as THREE from "three";

export class MercartorSphere extends THREE.Geometry {
    radius: number;
    widthSegments: number;
    heightSegments: number;
    t: number;
    vertices: THREE.Vector3[];
    prototype: {};
    constructor(radius: number, widthSegments: number, heightSegments: number) {
        super();
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;

        this.t = 0;

        let x: number;
        let y: number;
        const vertices = [];
        const uvs = [];

        function interplolate(a, b, t) {
            return (1 - t) * a + t * b;
        }

        // interpolates between sphere and plane
        function interpolateVertex(u: number, v: number, t: number) {
            const maxLng: number = Math.PI * 2;
            const maxLat: number = Math.PI;

            const sphereX: number = - this.radius * Math.cos(u * maxLng) * Math.sin(v * maxLat);
            const sphereY: number = - this.radius * Math.cos(v * maxLat);
            const sphereZ: number = this.radius * Math.sin(u * maxLng) * Math.sin(v * maxLat);

            const planeX: number = u * this.radius * 2 - this.radius;
            const planeY: number = v * this.radius * 2 - this.radius;
            const planeZ: number = 0;

            const x1: number = interplolate(sphereX, planeX, t);
            const y1: number = interplolate(sphereY, planeY, t);
            const z: number = interplolate(sphereZ, planeZ, t);

            return new THREE.Vector3(x1, y1, z);
        }

        // http://mathworld.wolfram.com/MercatorProjection.html
        // Mercator projection goes form +85.05 to -85.05 degrees
        function interpolateUV(u: number, v: number, t: number) {
            const lat: number = (v - 0.5) * 89.99 * 2 / 180 * Math.PI; // turn from 0-1 into lat in radians
            const sin: number = Math.sin(lat);
            const normalizedV: number = 0.5 + 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
            return new THREE.Vector2(u, normalizedV); // interplolate(normalizedV1, v, t))
        }

        for (y = 0; y <= heightSegments; y++) {

            const verticesRow: number[] = [];
            const uvsRow: number[] = [];

            for (x = 0; x <= widthSegments; x++) {

                const u: number = x / widthSegments;
                const v: number = y / heightSegments;

                this.vertices.push(interpolateVertex.call(this, u, v, this.t));
                uvsRow.push(interpolateUV.call(this, u, v, this.t));
                verticesRow.push(this.vertices.length - 1);
            }

            vertices.push(verticesRow);
            uvs.push(uvsRow);

        }

        for (y = 0; y < this.heightSegments; y++) {

            for (x = 0; x < this.widthSegments; x++) {

                const v1: number = vertices[y][x + 1];
                const v2: number = vertices[y][x];
                const v3: number = vertices[y + 1][x];
                const v4: number = vertices[y + 1][x + 1];

                const n1: THREE.Vector3 = this.vertices[v1].clone().normalize();
                const n2: THREE.Vector3 = this.vertices[v2].clone().normalize();
                const n3: THREE.Vector3 = this.vertices[v3].clone().normalize();
                const n4: THREE.Vector3 = this.vertices[v4].clone().normalize();

                const uv1: THREE.Vector2 = uvs[y][x + 1];
                const uv2: THREE.Vector2 = uvs[y][x];
                const uv3: THREE.Vector2 = uvs[y + 1][x];
                const uv4: THREE.Vector2 = uvs[y + 1][x + 1];

                this.faces.push(new THREE.Face3(v1, v2, v3, [n1, n2, n3]));
                this.faces.push(new THREE.Face3(v1, v3, v4, [n1, n3, n4]));

                this.faceVertexUvs[0].push([uv1.clone(), uv2.clone(), uv3.clone()]);
                this.faceVertexUvs[0].push([uv1.clone(), uv3.clone(), uv4.clone()]);
            }
        }

        this.computeFaceNormals();
        this.computeVertexNormals();
        this.computeBoundingSphere();
    }
}