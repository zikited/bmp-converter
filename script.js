function convertImage() {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) {
        alert("Please select a PNG file first.");
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image on canvas
            ctx.drawImage(img, 0, 0);

            // Get image data
            let imageData = ctx.getImageData(0, 0, img.width, img.height);
            let pixels = imageData.data;
            
            // Reduce to 256 colors
            let colorMap = new Map();
            let colorArray = [];
            let indexedPixels = new Uint8Array(img.width * img.height);

            for (let i = 0; i < pixels.length; i += 4) {
                let color = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]; // RGB
                if (!colorMap.has(color)) {
                    if (colorArray.length < 256) {
                        colorMap.set(color, colorArray.length);
                        colorArray.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
                    } else {
                        color = 0; // Default to black if full
                    }
                }
                indexedPixels[i / 4] = colorMap.get(color);
            }

            while (colorArray.length < 256) colorArray.push([0, 0, 0]); // Fill palette to 256 colors

            // Generate BMP file
            let bmpData = createBMP(img.width, img.height, indexedPixels, colorArray);
            let blob = new Blob([bmpData], { type: "image/bmp" });
            let url = URL.createObjectURL(blob);

            let downloadLink = document.getElementById("downloadLink");
            downloadLink.href = url;
            downloadLink.download = "output.bmp";
            downloadLink.style.display = "block";
            downloadLink.innerText = "Download BMP";
        };

        img.src = event.target.result;
    };

    reader.readAsDataURL(file);
}

function createBMP(width, height, pixels, palette) {
    const rowSize = (width + 3) & ~3; // BMP row alignment
    const fileSize = 54 + (256 * 4) + (rowSize * height);
    let bmp = new ArrayBuffer(fileSize);
    let view = new DataView(bmp);

    // BMP Header
    let offset = 0;
    view.setUint16(offset, 0x4D42, true); offset += 2; // 'BM'
    view.setUint32(offset, fileSize, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4;
    view.setUint32(offset, 54 + (256 * 4), true); offset += 4;

    // DIB Header
    view.setUint32(offset, 40, true); offset += 4;  // DIB header size
    view.setInt32(offset, width, true); offset += 4;
    view.setInt32(offset, -height, true); offset += 4; // Negative for top-down
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 8, true); offset += 2;  // 8-bit indexed color
    view.setUint32(offset, 0, true); offset += 4;  // No compression
    view.setUint32(offset, rowSize * height, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4;
    view.setUint32(offset, 256, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4;

    // Color Palette (B, G, R, 0)
    for (let i = 0; i < 256; i++) {
        let [r, g, b] = palette[i];
        view.setUint8(offset++, b);
        view.setUint8(offset++, g);
        view.setUint8(offset++, r);
        view.setUint8(offset++, 0);
    }

    // Pixel Data
    for (let y = 0; y < height; y++) {
        let rowStart = offset + y * rowSize;
        for (let x = 0; x < width; x++) {
            view.setUint8(rowStart + x, pixels[y * width + x]);
        }
    }

    return bmp;
}
