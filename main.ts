
function get(what: string): HTMLElement {
    return document.getElementById(what);
}

class Main {

    static elapsedTime: number;
    static lastTime: number;

    static canvas: HTMLCanvasElement;
    static context: CanvasRenderingContext2D;
    static canvasClientRect: ClientRect;

    static level: Level;

    init(): void {
        Main.canvas = <HTMLCanvasElement>get('main-canvas');
        Main.canvas.width = 720;
        Main.canvas.height = 480;
        Main.canvasClientRect = Main.canvas.getClientRects().item(0);

        Main.context = Main.canvas.getContext('2d');

        new Mouse();
        new Camera();

        DefaultLevels.init();
        Main.level = new Level(DefaultLevels.levels[0]);

        Main.lastTime = Date.now();
        Main.elapsedTime = 0;

        Main.loop();
    }

    static loop(): void {
        requestAnimationFrame(Main.loop);

        Main.context.fillStyle = "#09c6f6";
        Main.context.fillRect(0, 0, Main.canvas.width, Main.canvas.height);

        Main.update();
        Main.render();

        var now = Date.now();
        var delta = now - Main.lastTime;
        Main.elapsedTime += delta;
        Main.lastTime = now;
    }

    static update(): void {
        Main.level.player.update();
        Main.level.update();
    }

    static render(): void {
        Main.level.render();
    }
}

/**
    Level layout:
        First index (levels[0][0]):
            Options:
                -tiles wide
                -tiles high
                -player starting x
                -player starting y
        Remaining items (levels[0][1]-levels[0][w*h]):
            width*height numbers - in range [0,3]
            Types:
                0: Black void (death for cursor and player)
                1: Light cyan (fine for both)
                2: Red (only player)
                3: Green (only cursor)

*/
class DefaultLevels {
    static levels: any[][];

    static init(): void {
        var lvl1 = new Array<any>();
        lvl1 = [[10, 7, 2, 6],
                0, 0, 0, 0, 3, 0, 0, 0, 2, 1,
                0, 0, 0, 0, 0, 3, 0, 0, 2, 1,
                0, 0, 0, 1, 1, 1, 1, 1, 1, 1,
                0, 0, 0, 1, 2, 2, 2, 2, 2, 2,
                0, 0, 0, 1, 0, 0, 0, 3, 0, 0,
                0, 1, 1, 1, 0, 0, 0, 0, 3, 0,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 3];
        DefaultLevels.levels = new Array<Array<any>>();
        DefaultLevels.levels.push(lvl1);
    }
}

class Level {

    pixelsWide: number;
    pixelsHigh: number;
    tilesWide: number;
    tilesHigh: number;
    tileSize: number;
    tiles: number[];

    paused: boolean = false;
    player: Player;
    itemBlocks: ItemBlock[]; // LATER(AJ): Rename these to coins
    target: Target;

    constructor(level: any[]) {
        var i;

        this.tilesWide = level[0][0];
        this.tilesHigh = level[0][1];
        if (level.length !== this.tilesWide * this.tilesHigh + 1) {
            console.error("Invalid level: ", level);
        }
        this.tileSize = 80;
        this.pixelsWide = this.tilesWide * this.tileSize;
        this.pixelsHigh = this.tilesHigh * this.tileSize;

        this.tiles = new Array<number>();
        for (i = 0; i < this.tilesWide * this.tilesHigh; ++i) {
            this.tiles.push(level[i+1]);
        }

        this.player = new Player(level[0][2] * this.tileSize - this.tileSize/2,
                                 level[0][3] * this.tileSize - this.tileSize/2);
        this.itemBlocks = new Array<ItemBlock>();
        for (i = 0; i < 5; ++i) {
            var x, y;
            // NOTE(AJ): Only generate on cyan blocks that don't already have an ItemBlock
            do {
                x = Math.floor(Math.random() * this.tilesWide);
                y = Math.floor(Math.random() * this.tilesHigh);
            } while ((this.tiles[x + y * this.tilesWide] !== 1) ||
                (this.isItemBlockAt(x * this.tileSize + this.tileSize / 2,
                                     y * this.tileSize + this.tileSize / 2)));

            this.itemBlocks.push(new ItemBlock(x * this.tileSize + this.tileSize / 2,
                                               y * this.tileSize + this.tileSize / 2,
                                               15, 15));
        }

        this.target = new Target();
    }

    isItemBlockAt(x: number, y: number): boolean {
        for (var i in this.itemBlocks) {
            if (this.itemBlocks[i].x === x && this.itemBlocks[i].y === y) {
                return true;
            }
        }
        return false;
    }

    update(): void {
        this.player.update();

        var index = this.collides();
        if (index !== -1) {
            if (this.itemBlocks[index].destroy()) {
                Sound.play(Sound.blip);
            }
        }

        Camera.followPlayer(this.player);

        for (var i in this.itemBlocks) {
            this.itemBlocks[i].update();
        }

        this.target.update();
    }

    collides(): number {
        for (var i in this.itemBlocks) {
            var block = this.itemBlocks[i];

            var w = 0.3 * (block.width + this.player.width);
            var h = 0.3 * (block.height + this.player.height);
            var dx = (block.x - this.player.x);
            var dy = (block.y - this.player.y);

            // NOTE(AJ): Fancy Minkowski sum!
            if (Math.abs(dx) <= w && Math.abs(dy) <= h) {
                return parseInt(i);
            }
        }
        return -1; // no collisions
    }

    render(): void {
        Main.context.fillStyle = Color.offblack.toString();
        Main.context.fillRect(0, 0, Main.canvas.width, Main.canvas.height);

        for (var i in this.tiles) {
            Main.context.fillStyle = this.getTilesColor(this.tiles[i]);
            var x = (parseInt(i) % this.tilesWide) * this.tileSize - Camera.xo;
            var y = Math.floor(parseInt(i) / this.tilesWide) * this.tileSize - Camera.yo;
            Main.context.fillRect(x, y, this.tileSize+1, this.tileSize+1);
            // NOTE(AJ):
        }

        for (var i in this.itemBlocks) {
            this.itemBlocks[i].render();
        }

        this.player.render();
        this.target.render();
    }

    getTilesColor(type: number): string {
        switch (type) {
            case 0:
                return Color.offblack.toString();
            case 1:
                return Color.lightcyan.toString();
            case 2:
                return Color.red.toString();
            case 3:
                return Color.green.toString();
            default:
                return Color.offblack.toString();
        }
    }

    togglePaused(): void {
        this.paused = !this.paused;
    }
}

class ItemBlock {

    x: number;
    y: number;
    width: number;
    height: number;

    deathTimer: number;
    deathTimerLength: number = 30;

    heightOffset: number;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.deathTimer = -1;
        this.heightOffset = Math.random() * Math.PI * 2;
    }

    update(): void {
        if (this.deathTimer != -1) {
            this.deathTimer--;
            if (this.deathTimer < 0) {
                Main.level.itemBlocks.splice(Main.level.itemBlocks.indexOf(this), 1);
            }
        }
    }

    render() {
        var scale = 1.0;
        var coinFillStyle;
        if (this.deathTimer > -1 && this.deathTimer < this.deathTimerLength) {
            var alpha = this.deathTimer / 100;
            coinFillStyle = "rgba(255,255,25, " + alpha +")";
            scale = 1 / (alpha * 2);
        } else {
            coinFillStyle = "#ffff19";
        }
        var altitude = Math.sin(Main.elapsedTime/400 + this.heightOffset) * 3;
        var x = this.x - scale * (this.width / 2);
        var y = this.y - scale * (this.height / 2);

        if (scale === 1.0) {
            var shadowDarkness = Math.floor(((5 - altitude)/6)*60 + 20);
            var xSlide = ((altitude + 5)/6)*1.5;
            Main.context.fillStyle = "rgba(" +
                shadowDarkness + "," +
                shadowDarkness + "," +
                shadowDarkness + ",0.5)";
            Main.context.fillRect(x + 1 - Camera.xo, y + 2 + 5 - Camera.yo,
                this.width, this.height);
        }
        Main.context.fillStyle = coinFillStyle;
        Main.context.fillRect(x - Camera.xo, y + altitude - Camera.yo,
            this.width * scale, this.height * scale);
    }

    destroy(): boolean {
        if (this.deathTimer === -1) {
            this.deathTimer = this.deathTimerLength;
            return true;
        } else {
            return false;
        }
    }

}

class Player {
    x: number;
    y: number;
    xv: number;
    yv: number;
    width: number;
    height: number;
    dir: number; // [0, 2pi]
    eyeBlinkTimer: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.xv = 0;
        this.yv = 0;
        this.dir = Math.PI / 2;
        this.width = 50;
        this.height = 50;
        this.blink();
    }

    update(): void {
        var vel = 0.4;
        if (Keyboard.keysdown[Keyboard.KEYS.W] || Keyboard.keysdown[Keyboard.KEYS.UP]) {
            this.xv += Math.cos(this.dir) * vel;
            this.yv += Math.sin(this.dir) * vel;
        } else if (Keyboard.keysdown[Keyboard.KEYS.S] || Keyboard.keysdown[Keyboard.KEYS.DOWN]) {
            this.xv += Math.cos(this.dir) * -vel;
            this.yv += Math.sin(this.dir) * -vel;
        }

        this.x += this.xv;
        this.y += this.yv;

        if (this.x < this.width / 2) {
            this.x = this.width / 2;
        } else if (this.x + this.width/2 > Main.level.pixelsWide) {
            this.x = Main.level.pixelsWide - this.width/2;
        }
        if (this.y < this.height / 2) {
            this.y = this.height / 2;
        } else if (this.y + this.height/2 > Main.level.pixelsHigh) {
            this.y = Main.level.pixelsHigh - this.height/2;
        }

            // FIXME(AJ): This
        if (Math.abs(Main.level.target.x - (this.x)) > 3 &&
           Math.abs(Main.level.target.y - (this.y)) > 3) {
            this.dir = Math.atan2(Main.level.target.y - (this.y),
                Main.level.target.x - (this.x));
        }

        this.xv *= 0.85;
        this.yv *= 0.85;

        if (Math.abs(this.xv) < 0.001) {
            this.xv = 0;
        }
        if (Math.abs(this.yv) < 0.001) {
            this.yv = 0;
        }

        this.eyeBlinkTimer--;
        if (this.eyeBlinkTimer < 0) {
            this.blink();
        }
    }

    render(): void {
        Main.context.save();
        {
            Main.context.translate(this.x - Camera.xo,
                                   this.y - Camera.yo);
            Main.context.rotate(this.dir);
            Main.context.fillStyle = "red";
            var height = this.height - (this.xv * this.xv + this.yv * this.yv) / 2;
            Main.context.fillRect(-this.width / 2, -height / 2, this.width, height);

            if (this.eyeBlinkTimer > 10) {
                Main.context.fillStyle = "white";
                Main.context.fillRect(10, -8 - 10, 10, 10);
                Main.context.fillRect(10, 8, 10, 10);
                Main.context.fillStyle = "black";

                var xx = (Main.level.target.x - (this.x));
                var yy = (Main.level.target.y - (this.y));
                var targetDist = (xx * xx) + (yy * yy);
                var pupilY = 8 + (targetDist / 5000);
                pupilY = Math.min(Math.max(8, pupilY), 11);

                Main.context.fillRect(15, -pupilY - 5, 5, 5);
                Main.context.fillRect(15, pupilY, 5, 5);
            }
        }
        Main.context.restore();
    }

    blink() {
        this.eyeBlinkTimer = Math.random() * 300 + 300;
    }
}

class Target {
    x: number;
    y: number;
    radius: number;

    constructor() {
        this.x = 0;
        this.y = 0;
        this.radius = 12;
    }

    update(): void {
        this.x = Mouse.x + Camera.xo;
        this.y = Mouse.y + Camera.yo;
    }

    clamp(): void {

    }

    render(): void {
        Main.context.beginPath();
        Main.context.fillStyle = "#D23C50";
        Main.context.arc(this.x - Camera.xo, this.y - Camera.yo, this.radius, 0, 2 * Math.PI, false);
        Main.context.fill();
    }
}

class Camera {

    static xo: number;
    static yo: number;

    static viewportWidth: number;
    static viewportHeight: number;


    constructor() {
        Camera.xo = 0;
        Camera.yo = 500;

        Camera.viewportWidth = Main.canvas.width;
        Camera.viewportHeight = Main.canvas.height;
    }

    static followPlayer(player: Player): void {
        var targetXo = player.x - Camera.viewportWidth / 2;
        var targetYo = player.y - Camera.viewportHeight / 2;

        Camera.xo = Camera.xo + (targetXo - Camera.xo) * 0.1;
        Camera.yo = Camera.yo + (targetYo - Camera.yo) * 0.1;

        if (Math.abs(Camera.xo - targetXo) < 0.1) {
            Camera.xo = targetXo;
        }
        if (Math.abs(Camera.yo - targetYo) < 0.1) {
            Camera.yo = targetYo;
        }

        Camera.clamp();
    }

    static clamp(): void {
        Camera.xo = Math.min(Math.max(0, Camera.xo), Main.canvas.width);
        Camera.yo = Math.min(Math.max(0, Camera.yo), Main.canvas.height);
    }

}

class Color {
    static offblack: Color = new Color(12, 12, 12);
    static lightcyan: Color = new Color(141, 255, 255);
    static red: Color = new Color(179, 51, 51);
    static green: Color = new Color(4, 150, 53);

    r: number;
    g: number;
    b: number;

    constructor(r: number, g: number, b: number) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    toString(): string {
        return "rgb(" + this.r + "," + this.g + "," + this.b + ")";
    }

    // NOTE(AJ): Writing the stuff below was a big waste of time :( No need for hex

    // Not the prettiest overloaded constructors, but they work
    // constructor(hex: string);
    // constructor(r: number, g: number, b: number);
    // constructor(rOrHex: any, g?: number, b?: number) {
    //     if (typeof(rOrHex) === "string") {
    //         var color = this.hexToRgb(rOrHex);
    //         this.r = color.r;
    //         this.g = color.g;
    //         this.b = color.b;
    //     } else {
    //         this.r = <number>rOrHex;
    //         this.g = g;
    //         this.b = b;
    //     }
    // }

    // // Thanks to Tim Down on StackOverflow for these color mode conversion methods
    // componentToHex(c: number) {
    //     var hex = c.toString(16);
    //     return hex.length === 1 ? "0" + hex : hex;
    // }

    // rbgToHex(): string {
    //     return "#" + this.componentToHex(this.r) +
    //                  this.componentToHex(this.g) +
    //                  this.componentToHex(this.b);
    // }

    // hexToRgb(hex: string): Color {
    //     // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    //     var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    //     hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    //         return r + r + g + g + b + b;
    //     });

    //     var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    //     return result ? new Color(
    //         parseInt(result[1], 16),
    //         parseInt(result[2], 16),
    //         parseInt(result[3], 16)
    //     ) : null;
    // }

}

class Sound {

    static blip: HTMLAudioElement;

    static muted: boolean = false;
    static volume: number = 0.6;

    // static volumeSlider: HTMLInputElement;

    static init(): void {
        Sound.blip = <HTMLAudioElement>get('blipSound');

        // Sound.volumeSlider = get('volumeSlider');
    }

    static toggleMute(): void {
        Sound.muted = !Sound.muted;
    }

    static changeVolume(volume: number): void {
        Sound.volume = volume;
    }

    static play(sound: HTMLAudioElement): void {
        if (Sound.muted) {
            return;
        }
        sound.volume = Sound.volume;
        sound.currentTime = 0;
        sound.play();
    }
}

class Keyboard {
    static KEYS = {
        BACKSPACE: 8, TAB: 9, RETURN: 13, ESC: 27, SPACE: 32, PAGEUP: 33, PAGEDOWN: 34, END: 35, HOME: 36, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, INSERT: 45, DELETE: 46, ZERO: 48, ONE: 49, TWO: 50, THREE: 51, FOUR: 52, FIVE: 53, SIX: 54, SEVEN: 55, EIGHT: 56, NINE: 57, A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71, H: 72, I: 73, J: 74, K: 75, L: 76, M: 77, N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85, V: 86, W: 87, X: 88, Y: 89, Z: 90, TILDE: 192, SHIFT: 999
    };

    static keysdown = [];

    static keychange(event: KeyboardEvent, down: boolean): void {
        var keycode = event.keyCode ? event.keyCode : event.which;
        Keyboard.keysdown[keycode] = down;

        if (down && keycode === Keyboard.KEYS.ESC) {
            Main.level.togglePaused();
        }
    }
}

class Mouse {
    static x: number;
    static y: number;
    static ldown: boolean;
    static rdown: boolean;

    constructor() {
        Mouse.x = -1;
        Mouse.y = -1;
        Mouse.ldown = false;
        Mouse.rdown = false;
    }

    static onmousebutton(event: MouseEvent, down: boolean) {
        if (event.button === 1 || event.which === 1) Mouse.ldown = down;
        else if (event.button === 3 || event.which === 3) Mouse.rdown = down;
    }

    static onmousemove(event: MouseEvent) {
        var px = Mouse.x,
            py = Mouse.y;
        Mouse.x = event.clientX - Main.canvasClientRect.left;
        Mouse.y = event.clientY - Main.canvasClientRect.top - 14;
        // TODO(AJ): Fix this jankyness and add crossbrowser support
    }
}

function keydown(event: KeyboardEvent) {
    Keyboard.keychange(event, true);

    if (event.keyCode === Keyboard.KEYS.SPACE) return false;
}

function keyup(event: KeyboardEvent) {
    Keyboard.keychange(event, false);
}

window.onkeydown = keydown;
window.onkeyup = keyup;

function clickType(event: MouseEvent): string {
    if (event.which === 3 || event.button === 2)
        return "right";
    else if (event.which === 1 || event.button === 0)
        return "left";
    else if (event.which === 2 || event.button === 1)
        return "middle";
}

window.onload = function() {
    Sound.init();
    new Main().init();
}

window.onmousedown = function(event) { Mouse.onmousebutton(event, true); };
window.onmouseup = function(event) { Mouse.onmousebutton(event, false); };
window.oncontextmenu = function() { return false; };
window.onmousemove = function(event) { Mouse.onmousemove(event); };
