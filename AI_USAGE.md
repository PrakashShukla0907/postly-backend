# AI Usage Policy - Postly

To be completely transparent and in line with the Credes AI Usage Policy, I wanted to document how I used AI while building this backend. 

Honestly, I treated AI more like a really fast autocomplete and an interactive documentation manual rather than having it write the core logic for me. Everything from the database schema design to the actual API routes and queuing system was built, tested, and debugged by me by hand.

Here’s a quick breakdown of where I actually used tools like Copilot and ChatGPT:

### 1. Database Schema
I sketched out the relationships and tables for the PostgreSQL schema myself. Where AI helped was just auto-completing some of the Prisma-specific syntax (like throwing in the `@default(uuid())` tags) which saved me a lot of repetitive typing. I personally ran and verified all the migrations to ensure they matched the assignment requirements.

### 2. BullMQ & Queue Architecture
Setting up Redis and worker queues involves a lot of boilerplate. I used AI to grab some standard connection setup code and double-check the syntax for BullMQ’s custom backoff strategies. However, the actual logic handling the exponential math for retries and the job processors themselves was all written manually. I also spent quite a bit of time testing the retry behavior locally by deliberately breaking the APIs.

### 3. Telegram Bot State Management
I used grammY for the bot, and navigating their conversation plugin documentation can be tricky. I asked AI for a few syntax examples on how to manage multi-step states properly. After seeing how the library structured things, I built out the validation layers and Redis session integration on my own.

### 4. Integration Testing
Writing tests is crucial, but typing out `beforeEach` and `afterAll` hooks to clean up the database over and over gets tedious. I used AI to scaffold those basic test structures and stub out some empty mock functions. The actual test assertions and edge-case logic were done manually to ensure the suite hit a 100% pass rate.

### 5. Content Generation Service
When integrating OpenAI and Anthropic, the hardest part is getting the AI to return consistent JSON. I used ChatGPT to help me tweak the JSON schema instruction string that I pass into the prompts to ensure it wouldn't break my parsers. I handled the SDK integration, secure key management, and error handling myself.

### Final Thoughts
I am really proud of this codebase. I used AI to speed up my typing and look up documentation syntax quickly, but I was in the driver's seat for all the architectural decisions and business logic. I understand every line of code here and would be happy to talk through any technical decisions I made during an interview!