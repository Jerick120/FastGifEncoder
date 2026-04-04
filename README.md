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
| `FastGifEncoder` |   21.40   | 
|  `gif-encoder`   | 33516.04  |
| `gif-encoder-2`  | 37498.61  |
|   `modern-gif`   | 43479.89  |
| `@skyra/gifenc`  | 19560.38  |

### Speed optimization `off`

|     Encoder      | Time (ms) |
|:----------------:|:---------:|
| `FastGifEncoder` |   31.04   | 
|  `gif-encoder`   | 35122.83  |
| `gif-encoder-2`  | 47624.25  |
|   `modern-gif`   | 47922.61  |
| `@skyra/gifenc`  | 30334.92  |
