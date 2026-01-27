import './style.css'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, Color4 } from '@babylonjs/core';

class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;

    constructor() {
        this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
        this.engine = new Engine(this.canvas, true);
        this.scene = this.createScene();

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    private createScene(): Scene {
        const scene = new Scene(this.engine);
        
        // Clear color to sky blue
        scene.clearColor = new Color4(0.5, 0.8, 1, 1);

        // Camera
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, new Vector3(0, 0, 0), scene);
        camera.attachControl(this.canvas, true);

        // Light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        // Test Cube
        MeshBuilder.CreateBox("box", { size: 2 }, scene);
        
        return scene;
    }
}

new Game();
