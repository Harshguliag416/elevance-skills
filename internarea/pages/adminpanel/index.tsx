import React from 'react'
import {
  Briefcase,
  Mail,
  Send,
  Users,
  BarChart,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from "react-i18next";
const index = () => {
    const { t } = useTranslation();
    const stats = [
        { label: 'totalApplications', value: '2,345', change: '+12%', changeType: 'positive' },
        { label: 'activeJobs', value: '45', change: '+3%', changeType: 'positive' },
        { label: 'activeInternships', value: '89', change: '+24%', changeType: 'positive' },
        { label: 'conversionRate', value: '5.25%', change: '-1.3%', changeType: 'negative' },
      ];

      const menuItems = [
        {
          title: 'viewApplications',
          description: 'viewApplicationsDesc',
          icon: Mail,
          link: '/applications',
          color: 'bg-blue-600',
        },
        {
          title: 'postJob',
          description: 'postJobDesc',
          icon: Briefcase,
          link: '/postJob',
          color: 'bg-green-600',
        },
        {
          title: 'postInternship',
          description: 'postInternshipDesc',
          icon: Send,
          link: '/postInternship',
          color: 'bg-purple-600',
        },
        {
          title: 'manageUsers',
          description: 'manageUsersDesc',
          icon: Users,
          link: '/users',
          color: 'bg-orange-600',
        },
        {
          title: 'analytics',
          description: 'analyticsDesc',
          icon: BarChart,
          link: '/analytics',
          color: 'bg-red-600',
        },
        {
          title: 'settings',
          description: 'settingsDesc',
          icon: Settings,
          link: '/settings',
          color: 'bg-gray-600',
        },
      ];
  return (
    <div className="min-h-screen bg-gray-50 py-8">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("adminPanel.title")}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("adminPanel.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">
                    {t(`adminPanel.stat.${stat.label}`)}
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
                <div className={`${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            href={item.link}
            className="block bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className={`${item.color} p-3 rounded-lg`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t(`adminPanel.menu.${item.title}`)}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t(`adminPanel.menu.${item.description}`)}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  </div>
  )
}

export default index
