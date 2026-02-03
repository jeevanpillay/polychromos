---
description: Creative and design-focused research for visual implementations, animations, and UI patterns
model: opus
---

# Research Design

You are tasked with conducting design-focused research to inform creative implementations. You'll gather visual references, implementation patterns, code examples, and inspiration to help achieve specific design effects and interactions.

## CRITICAL: YOUR JOB IS TO INSPIRE AND INFORM CREATIVE IMPLEMENTATIONS

- Research visual effects, animations, and UI patterns
- Find working demos, Codepens, and real-world examples
- Gather implementation approaches and code snippets
- Compare libraries by feel, quality, and developer experience
- Curate inspiration from design-forward sites
- Focus on "how to achieve this effect" not "what are the metrics"

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to research design implementations. Describe the visual effect, animation, or UI pattern you want to achieve, and I'll gather inspiration, implementation approaches, and code examples to help you build it.
```

Then wait for the user's design query.

## Steps to follow after receiving the design query:

1. **Understand the creative intent:**
   - Ask clarifying questions if needed using AskUserQuestion
   - Identify the core visual effect or interaction
   - Understand the mood/feel they're going for
   - Note any constraints (performance, browser support, framework)
   - Check if there's a design reference or inspiration they're working from

2. **Decompose the design challenge:**
   - Break down into component effects (e.g., "overlay slide" + "ASCII reveal" + "page transition")
   - Identify technical approaches (CSS animations, Canvas, WebGL, SVG, JS libraries)
   - Determine what types of references would help (demos, tutorials, source code)
   - Plan search angles (effect name, technique, library, inspiration sites)

3. **Execute parallel web searches:**
   - Launch web-search-researcher agent to gather information
   - Search for:
     - **Live demos** - Codepen, CodeSandbox, JSFiddle examples
     - **Inspiration** - Awwwards, Dribbble, siteinspire, minimal.gallery
     - **Tutorials** - How-to articles, YouTube breakdowns, CSS-Tricks
     - **Libraries** - GSAP, Framer Motion, anime.js, Three.js, Lenis
     - **Source code** - GitHub repos, open-source implementations
     - **Similar effects** - Sites that achieve comparable results
   - Use creative search terms (effect names, animation types, visual styles)

4. **Curate and analyze findings:**
   - Organize references by implementation approach
   - Identify the most promising techniques
   - Note browser/performance considerations
   - Extract relevant code patterns
   - Rank by quality of effect and implementation complexity

5. **Gather metadata:**
   - Current date and time
   - Researcher name (your identifier)
   - Design challenge and original query
   - Key references found
   - Recommended approach

6. **Generate thoughts document:**
   - Filename: `thoughts/shared/research/YYYY-MM-DD-design-research-description.md`
     - Format: `YYYY-MM-DD-design-research-description.md` where:
       - YYYY-MM-DD is today's date
       - description is a brief kebab-case description
     - Examples:
       - `2025-12-11-design-research-ascii-page-transitions.md`
       - `2025-12-11-design-research-morphing-text-effects.md`
       - `2025-12-11-design-research-scroll-triggered-animations.md`

   - Structure with YAML frontmatter:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: [Researcher identifier]
     topic: "[Design Challenge]"
     tags: [design, research, relevant-keywords, effect-type]
     status: complete
     created_at: [Current date in YYYY-MM-DD format]
     effect_type: [animation | transition | interaction | visual-effect | layout]
     complexity: simple | moderate | complex
     ---

     # Design Research: [Design Challenge]

     **Date**: [Current date and time with timezone]
     **Challenge**: [Original design query]
     **Effect Type**: [animation/transition/interaction/etc.]
     **Complexity**: [simple/moderate/complex]

     ## Design Challenge
     [Original user query - what they want to achieve]

     ## Creative Summary
     [1-2 paragraph overview of the best approaches to achieve this effect, written for a designer/developer audience]

     ## Inspiration Gallery

     ### Live Demos
     | Demo | Technique | Link | Notes |
     |------|-----------|------|-------|
     | [Name] | [CSS/GSAP/Canvas/etc.] | [URL] | [Why it's relevant] |
     | [Name] | [Technique] | [URL] | [Notes] |

     ### Sites Using Similar Effects
     | Site | Effect | Link | What to Notice |
     |------|--------|------|----------------|
     | [Site name] | [Description] | [URL] | [Key detail] |
     | [Site name] | [Description] | [URL] | [Key detail] |

     ### Design References
     - [Dribbble/Awwwards link] - [Why it's relevant]
     - [Link] - [Description]

     ## Implementation Approaches

     ### Approach 1: [e.g., "CSS Clip-Path + Transitions"]
     **Complexity**: [Simple/Moderate/Complex]
     **Best For**: [When to use this approach]
     **Limitations**: [What it can't do well]

     **How it works**:
     [Brief explanation of the technique]

     **Key Code Pattern**:
     ```css
     /* or js/tsx depending on approach */
     [Relevant code snippet]
     ```

     **Resources**:
     - [Tutorial/Demo link] - [Description]
     - [Documentation link]

     ### Approach 2: [e.g., "GSAP Timeline Animation"]
     **Complexity**: [Simple/Moderate/Complex]
     **Best For**: [When to use this approach]
     **Limitations**: [What it can't do well]

     [Same structure as above]

     ### Approach 3: [e.g., "Canvas/WebGL Rendering"]
     [If applicable - for more complex effects]

     ## Recommended Approach

     **For your use case, I recommend**: [Approach name]

     **Why**:
     - [Reason 1 - e.g., "Matches the smooth reveal effect you described"]
     - [Reason 2 - e.g., "Works well with React/TanStack"]
     - [Reason 3 - e.g., "Good browser support"]

     **Implementation Steps**:
     1. [Step 1]
     2. [Step 2]
     3. [Step 3]

     ## Libraries & Tools

     ### Recommended
     | Library | Use For | Bundle Size | Link |
     |---------|---------|-------------|------|
     | [Name] | [Purpose] | [Size] | [URL] |

     ### Alternatives
     | Library | Pros | Cons | Link |
     |---------|------|------|------|
     | [Name] | [Advantages] | [Disadvantages] | [URL] |

     ## Code Examples

     ### Basic Implementation
     ```tsx
     // Minimal example to achieve the core effect
     [Code]
     ```

     ### Enhanced Version
     ```tsx
     // More polished version with easing, timing, etc.
     [Code]
     ```

     ## Browser & Performance Notes

     - **Browser Support**: [Any limitations]
     - **Performance**: [GPU acceleration, repaints, etc.]
     - **Accessibility**: [Reduced motion considerations]
     - **Mobile**: [Touch/mobile considerations]

     ## ASCII Art Resources
     [If relevant to the query]
     - ASCII art generators: [Links]
     - ASCII animation libraries: [Links]
     - Font considerations: [Monospace fonts that work well]

     ## Related Effects to Explore

     - [Related effect 1] - [Brief description]
     - [Related effect 2] - [Brief description]

     ## Sources

     ### Demos & Codepens
     - [Title](URL) - [Author]

     ### Tutorials & Articles
     - [Title](URL) - [Author/Site], [Date]

     ### Libraries & Documentation
     - [Library](URL) - [Version noted if relevant]

     ### Inspiration Sites
     - [Site](URL) - [What to look at]

     ---

     **Last Updated**: [Today's date]
     **Ready to Implement**: [Yes/Needs more research]
     **Next Steps**: [What to do next - e.g., "Start with the GSAP approach, prototype the overlay animation first"]
     ```

7. **Add context references:**
   - Link to any related design documents in the codebase
   - Reference existing components that could be extended
   - Suggest complementary effects or patterns

8. **Present findings to user:**
   - Show 2-3 best visual references/demos
   - Recommend the approach that fits their needs
   - Share the thoughts document path
   - Offer to dive deeper into any specific technique
   - Ask if they want to see more examples or start implementation

## Important Notes:

- Prioritize **working demos over articles** - seeing is believing
- Focus on **quality of effect** not just technical correctness
- Include **code snippets** that can be adapted
- Note **browser support and performance** implications
- Consider **accessibility** (prefers-reduced-motion)
- For animations, note **easing and timing** that make effects feel good
- When comparing libraries, consider:
  - Quality of animation output
  - Developer experience / API design
  - Bundle size impact
  - Community and documentation
  - Framework compatibility (React, vanilla, etc.)

## Example Research Scenario:

**User Query**: "We're designing a site with an ASCII page transition - when navigating, a blue overlay slides in left-to-right revealing an ASCII cat in white lines, then slides out to show the new page."

**Research Breakdown**:
1. Search: "page transition overlay animation codepen"
2. Search: "ASCII art animation web javascript"
3. Search: "GSAP page transition tutorial"
4. Search: "clip-path reveal animation CSS"
5. Search: "awwwards sites creative page transitions"
6. Search: "react router page transition animation"

**Synthesis**: Curate the best overlay transition demos, find ASCII rendering approaches, recommend GSAP vs CSS approach based on complexity, provide starter code pattern.

**Output**: Document with visual references, recommended implementation (e.g., GSAP timeline with clip-path), code snippets for the overlay + ASCII reveal, and links to inspiring sites.

---

## File Management:

- Documents go to `thoughts/shared/research/`
- Use consistent YAML frontmatter
- Embed or link to visual references
- Include working code snippets
- Note the "feel" and timing of animations
- Link to Codepens/demos that can be forked
- Organize by implementation approach
