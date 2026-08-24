import { NavLink } from 'react-router-dom'

interface NavItem {
  label: string
  to: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Find lobby', to: '/find' },
  { label: 'Players', to: '/players' },
  { label: 'Friends', to: '/friends' },
  { label: 'Profile', to: '/profile/me' },
  { label: 'Settings', to: '/settings' }
]

export default function Sidebar() {
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-4">
      <div className="px-2 pb-6 text-lg font-semibold tracking-tight text-white">Gankr</div>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
