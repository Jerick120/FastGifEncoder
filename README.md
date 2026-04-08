# FastGifEncoder

An extremely fast zero dependency GIF encoder in under 1k lines of vanilla JS.

# Install

`npm install fastgifencoder`

# Usage

## Constructor

`FastGifEncoder(options)`

| Parameter |  Type  |              Description               | Required | Default |
|:---------:|:------:|:--------------------------------------:|:--------:|:-------:|
|  `width`  | number |         Frame width in pixels          |   yes    |    0    |
| `height`  | number |         Frame height in pixels         |   yes    |    0    |
|  `loop`   | number |     Loop count (0 to loop forever)     |    no    |    0    |
| `quality` | number | Quality 1-30 (lower is better/slower)  |    no    |   20    |
| `format`  | string | RGB format: rgb565, rgb444 or rgba4444 |    no    | rgb565  |

## Methods

|   Method   |  Parameters   |                            Description                             |
|:----------:|:-------------:|:------------------------------------------------------------------:|
| `addFrame` | rgba, options | Adds the frame and accepts optional parameters (delay and dispose) |
|  `encode`  |      n/a      |               Begins encoding and returns the bytes.               |

# Examples & Benchmarks

Benchmarks measure encoding time only and may not be directly comparable across libraries due to differences in API
design like streaming vs in-memory, sync vs async, etc.

Run `example.js` in examples folder.

## Results

Encoding a `250` frame `60MB` GIF on a single thread.

### Speed optimization `on`

|     Encoder      | Time (ms) |
|:----------------:|:---------:|
| `FastGifEncoder` |  2870.05  | 
| `gif-encoder-2`  | 23705.25  |
|   `modern-gif`   | 24188.74  |
| `@skyra/gifenc`  | 16022.36  |
|     `gifenc`     |  4047.88  |

### Speed optimization `off`

|     Encoder      | Time (ms) |
|:----------------:|:---------:|
| `FastGifEncoder` |  5459.03  | 
| `gif-encoder-2`  | 44684.97  |
|   `modern-gif`   | 47098.18  |
| `@skyra/gifenc`  | 30597.54  |
|     `gifenc`     |  6544.22  |
