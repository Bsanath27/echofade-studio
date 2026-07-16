# Programmatic Polaroid Automation for Shorts

Instead of fighting against a pre-rendered motion graphic with baked-in checkerboards and manual tracking, the most robust and automated solution is to generate the entire polaroid effect **natively in code**. 

This approach completely eliminates manual coordinate mapping, chroma keying, and mask bleeding. It gives you a 100% automated, pixel-perfect pipeline for all your future Shorts.

## 1. The Core Assets
Instead of a video, you only need one static asset:
- **`polaroid_frame.png`**: A high-quality PNG of your polaroid frame with a **true transparent hole** in the middle and true transparency on the outside. (You can easily make this once in Canva, Photoshop, or Figma, complete with tape and drop shadows).
*(Note: A generated template has been saved as `polaroid_template.png` in the backend directory to get started).*

## 2. The Automated Pipeline (`PolaroidShortGenerator`)

We can build a Python class using `moviepy` and `PIL` that handles the entire assembly programmatically:

### Step A: Dynamic Text Generation
Using Python's `PIL.ImageDraw`, the script takes your chosen text (e.g., song title, lyrics, or a hook) and automatically writes it onto the bottom white space of the `polaroid_frame.png` using a custom font. 
*Benefit: You can generate 100 shorts with 100 different texts automatically.*

### Step B: Flawless Compositing
The script takes your background image/video and simply layers the `polaroid_frame.png` **on top** of it. Because the polaroid PNG has a real transparent hole, your background shows through perfectly. 
*Benefit: Zero mask leaking, zero pixelation, zero need to scale things by 30% to hide gaps.*

### Step C: The "Papersky" Animation
We group the background image and the polaroid frame into a single MoviePy `CompositeVideoClip` (let's call it the "Polaroid Group"). We then apply programmatic animation to this group:
- **Slide In**: We use `.set_position()` with an ease-out math function so the Polaroid Group slides in from the top of the screen (`y = -1000`) and settles in the center.
- **Rotate & Pop**: We use `.rotate()` and `.resize()` to add a slight 5-degree spin and a tiny scale-up after it settles, giving it that dynamic, organic feel.
*Benefit: You control the exact physics of the animation in code. No manual tracking coordinates (`QUAD_CORNERS`) are ever needed.*

### Step D: Final Assembly
The animated Polaroid Group is overlaid onto your main vertical Shorts background video. 

## 3. The Developer Experience

To generate a new short, your code will look as simple as this:

```python
generator = PolaroidShortGenerator(template="polaroid_frame.png")

generator.create_short(
    inner_photo="chicago_skyline.jpg",
    polaroid_text="Demo Intro",
    main_background="abstract_loop.mp4",
    output="final_short.mp4"
)
```
