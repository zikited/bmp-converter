document.getElementById("convertButton").addEventListener("click", () => {
    const files = document.getElementById("fileInput").files;
    if (files.length === 0) {
        alert("Please select at least one PNG file.");
        return;
    }

    const images = [];
    let processedImages = 0;
    const colorSet = new Map(); // Stores unique colors for all images

    // Load all images first
    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                images.push(img);
                extractColors(img, colorSet);
                processedImages++;
                if (processedImages === files.length) {
                    finalizePaletteAndConvert(images, colorSet);
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(files[i]);
    }
});

// Extract unique colors from an image
function extractColors(img, colorSet) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const colorKey = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
        if (!colorSet.has(colorKey) && colorSet.size < 255) { // Reserve the first color for black
            colorSet.set(colorKey, colorSet.size + 2); // Start palette from index 2 for actual colors
        }
    }
}

// Finalize the shared palette and convert images
function finalizePaletteAndConvert(images, colorSet) {
    let colorPalette = Array.from(colorSet.keys()).map(colorStr => colorStr.split(",").map(Number));

    // Ensure palette has exactly 256 colors
    while (colorPalette.length < 255) {
        colorPalette.push([0, 0, 0]); // Fill with black
    }

    // Add black as the first color in the palette
    colorPalette.unshift([0, 0, 0]);

    // Convert each image using the same color palette
    images.forEach((img, index) => {
        convertToBMP(img, colorPalette, index);
    });
}

function convertToBMP(img, palette, imageIndex) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Get image pixels
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;
    const indexedPixels = new Uint8Array(img.width * img.height);

    // Convert image to indexed color using the shared palette
    const colorMap = new Map(palette.map((color, i) => [color.join(","), i]));

    for (let i = 0; i < pixels.length; i += 4) {
        const colorKey = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
        indexedPixels[i / 4] = colorMap.get(colorKey) || 1; // Default to index 1 for any color not in palette
    }

    // Create BMP file
    const bmpData = createBMP(img.width, img.height, indexedPixels, palette);
    const blob = new Blob([bmpData], { type: "image/bmp" });
    const url = URL.createObjectURL(blob);

    // Display download link
    const downloadLinks = document.getElementById("downloadLinks");
    const link = document.createElement("a");
    link.href = url;
    link.download = `image_${imageIndex + 1}.bmp`;
    link.innerText = `Download BMP ${imageIndex + 1}`;
    link.classList.add("download-link");
    downloadLinks.appendChild(link);
}

// Generate BMP file with shared 256-color palette
function createBMP(width, height, pixels, palette) {
    const rowSize = (width + 3) & ~3; // Each row is padded to a multiple of 4 bytes
    const fileSize = 54 + (256 * 4) + (rowSize * height); // File size calculation
    let bmp = new ArrayBuffer(fileSize); // Create the buffer for the BMP file
    let view = new DataView(bmp);
    let offset = 0;

    // BMP Header
    view.setUint16(offset, 0x4D42, true); offset += 2; // 'BM' identifier
    view.setUint32(offset, fileSize, true); offset += 4; // File size
    view.setUint32(offset, 0, true); offset += 4; // Reserved (set to 0)
    view.setUint32(offset, 54 + (256 * 4), true); offset += 4; // Pixel data offset

    // DIB Header
    view.setUint32(offset, 40, true); offset += 4; // DIB header size
    view.setInt32(offset, width, true); offset += 4; // Image width
    view.setInt32(offset, -height, true); offset += 4; // Image height (negative for top-down)
    view.setUint16(offset, 1, true); offset += 2; // Number of color planes (always 1)
    view.setUint16(offset, 8, true); offset += 2; // Bits per pixel (8 for palette-based)
    view.setUint32(offset, 0, true); offset += 4; // Compression method (0 = none)
    view.setUint32(offset, rowSize * height, true); offset += 4; // Image size (uncompressed)
    view.setUint32(offset, 0, true); offset += 4; // Horizontal resolution (set to 0)
    view.setUint32(offset, 0, true); offset += 4; // Vertical resolution (set to 0)
    view.setUint32(offset, 256, true); offset += 4; // Number of colors in palette
    view.setUint32(offset, 0, true); offset += 4; // Important colors (0 means all)

    // Color Palette (B, G, R, 0) - Start with black color
    for (let i = 0; i < 256; i++) {
        let [r, g, b] = palette[i];
        view.setUint8(offset++, b); // Blue
        view.setUint8(offset++, g); // Green
        view.setUint8(offset++, r); // Red
        view.setUint8(offset++, 0); // Reserved (0)
    }

    // Pixel Data (Start from index 2 in the palette)
    for (let y = height - 1; y >= 0; y--) { // Start from the last row
        let rowStart = offset + (height - 1 - y) * rowSize;
        for (let x = 0; x < width; x++) {
            view.setUint8(rowStart + x, pixels[y * width + x]); // Set pixel color index
        }
    }

    return bmp;
}
