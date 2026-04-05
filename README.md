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
| `FastGifEncoder` |   16.86   | 
| `gif-encoder-2`  | 25981.85  |
|   `modern-gif`   | 27000.38  |
| `@skyra/gifenc`  | 16191.04  |
|     `gifenc`     |  3765.17  |

### Speed optimization `off`

|     Encoder      | Time (ms) |
|:----------------:|:---------:|
| `FastGifEncoder` |   30.59   | 
| `gif-encoder-2`  | 44828.40  |
|   `modern-gif`   | 49962.91  |
| `@skyra/gifenc`  | 35294.82  |
|     `gifenc`     |  9307.53  |
