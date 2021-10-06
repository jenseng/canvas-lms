/*
 * Copyright (C) 2014 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import ReactDOM from 'react-dom'
import {CreateCourseModal} from '@canvas/create-course-modal/react/CreateCourseModal'
import $ from 'jquery'
import I18n from 'i18n!course_list'
import ready from '@instructure/ready'

function success(target) {
  const favorited_tooltip = I18n.t('favorited_tooltip', 'Click to remove from the courses menu.')
  const nonfavorite_tooltip = I18n.t('nonfavorited_tooltip', 'Click to add to the courses menu.')
  const notfavoritable_tooltip = I18n.t(
    'This course cannot be added to the courses menu unless the course is active.'
  )

  if (target.hasClass('course-list-favorite-course')) {
    target.removeClass('course-list-favorite-course')
    if (target.hasClass('course-list-not-favoritable')) {
      target.removeAttr('data-favorite-url') // Remove the data so it won't be used later.
      target.off('click keyclick')
      target.attr('title', notfavoritable_tooltip)
      target.data('ui-tooltip-title', notfavoritable_tooltip)
      target.children('.screenreader-only').text(notfavoritable_tooltip)
      return
    }

    target.attr('title', nonfavorite_tooltip)
    // The tooltip wouldn't update with just changing the title so
    // it's forced to do so here. Same below in the else case.
    target.data('ui-tooltip-title', nonfavorite_tooltip)
    target.children('.screenreader-only').text(nonfavorite_tooltip)
    target.children('.course-list-favorite-icon').toggleClass('icon-star icon-star-light')
  } else {
    target.addClass('course-list-favorite-course')
    target.attr('title', favorited_tooltip)
    target.data('ui-tooltip-title', favorited_tooltip)
    target.children('.screenreader-only').text(favorited_tooltip)
    target.children('.course-list-favorite-icon').toggleClass('icon-star icon-star-light')
  }
}

ready(() => {
  $('[data-favorite-url]').on('click keyclick', function (event) {
    event.preventDefault()
    const url = $(this).data('favoriteUrl')
    const target = $(event.currentTarget)
    if (target.hasClass('course-list-favorite-course')) {
      $.ajaxJSON(url, 'DELETE', {}, success(target), null)
    } else {
      $.ajaxJSON(url, 'POST', {}, success(target), null)
    }
  })

  const startButton = document.getElementById('start_new_course')
  if (startButton && (ENV.K5_USER || ENV.FEATURES?.create_course_subaccount_picker)) {
    const container = document.getElementById('create_subject_modal_container')
    if (container) {
      startButton.addEventListener('click', () => {
        let role
        if (ENV.current_user_roles.includes('admin')) {
          role = 'admin'
        } else if (ENV.current_user_roles.includes('teacher')) {
          role = 'teacher'
        } else {
          // should never get here
          return
        }
        ReactDOM.render(
          <CreateCourseModal
            isModalOpen
            setModalOpen={isOpen => {
              if (!isOpen) ReactDOM.unmountComponentAtNode(container)
            }}
            permissions={role}
            isK5User={ENV.K5_USER}
          />,
          container
        )
      })
    }
  }
})
