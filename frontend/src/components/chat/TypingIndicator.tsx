/**
 * 3-dot typing indicator shown when the agent is "thinking".
 * Slow, fluid micro-animation per the design brief.
 */
export function TypingIndicator() {
    return (
        <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-primary text-primary-foreground px-4 py-3">
            <span
                className="size-1.5 rounded-full bg-primary-foreground animate-typing-bounce"
                style={{ animationDelay: "0ms" }}
            />
            <span
                className="size-1.5 rounded-full bg-primary-foreground animate-typing-bounce"
                style={{ animationDelay: "180ms" }}
            />
            <span
                className="size-1.5 rounded-full bg-primary-foreground animate-typing-bounce"
                style={{ animationDelay: "360ms" }}
            />
        </div>
    )
}
