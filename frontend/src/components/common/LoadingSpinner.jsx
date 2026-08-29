export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sz = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size]
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4">
      <svg className={`animate-spin text-blue-600 ${sz}`} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  )
}
