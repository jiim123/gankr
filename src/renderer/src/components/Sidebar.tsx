import { NavLink } from 'react-router-dom'
import { Search, Group, UserLove, User, Settings } from 'iconoir-react'
import gankrLogo from '../assets/gankw.svg'

interface NavItem {
  label: string
  to: string
  icon: typeof Search
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Find lobby', to: '/find', icon: Search },
  { label: 'Players', to: '/players', icon: Group },
  { label: 'Friends', to: '/friends', icon: UserLove },
  { label: 'Profile', to: '/profile/me', icon: User },
  { label: 'Settings', to: '/settings', icon: Settings }
]

export default function Sidebar() {
  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-neutral-800 bg-background px-3 py-4">
      <div className="px-2 pb-6">
        <img src={gankrLogo} alt="Gankr" className="h-7 w-auto" />
      </div>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-neutral-400 hover:bg-sidebar-hover hover:text-sidebar-hover-foreground'
                  ].join(' ')
                }
              >
                <Icon width={18} height={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
