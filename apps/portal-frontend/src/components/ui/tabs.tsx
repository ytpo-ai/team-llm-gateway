import { cn } from '@/lib/utils'
import { type ComponentProps, createContext, useContext, useMemo } from 'react'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>')
  return ctx
}

interface TabsProps extends ComponentProps<'div'> {
  value: string
  onValueChange: (value: string) => void
}

function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  const contextValue = useMemo<TabsContextValue>(
    () => ({ value, onValueChange }),
    [value, onValueChange],
  )

  return (
    <TabsContext.Provider value={contextValue}>
      <div data-slot="tabs" className={cn(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps extends ComponentProps<'div'> {}

function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps extends ComponentProps<'button'> {
  value: string
}

function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const ctx = useTabsContext()
  const active = ctx.value === value

  return (
    <button
      type="button"
      data-slot="tabs-trigger"
      data-state={active ? 'active' : 'inactive'}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        active && 'bg-background text-foreground shadow-sm',
        className,
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends ComponentProps<'div'> {
  value: string
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const ctx = useTabsContext()
  if (ctx.value !== value) return null

  return (
    <div
      data-slot="tabs-content"
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }