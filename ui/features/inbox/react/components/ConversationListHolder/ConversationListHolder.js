/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import {AlertManagerContext} from '@canvas/alerts/react/AlertManager'
import {Flex} from '@instructure/ui-flex'
import {Spinner} from '@instructure/ui-spinner'
import {useScope as useI18nScope} from '@canvas/i18n'
import PropTypes from 'prop-types'
import React, {useEffect, useState, useContext, useCallback, useMemo} from 'react'
import {useMutation} from 'react-apollo'
import InboxEmpty from '../../../svg/inbox-empty.svg'
import {ConversationContext} from '../../../util/constants'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'

import {ConversationListItem} from './ConversationListItem'
import {UPDATE_CONVERSATION_PARTICIPANTS} from '../../../graphql/Mutations'

const I18n = useI18nScope('conversations_2')

export const ConversationListHolder = ({
  isLoading,
  fetchMoreMenuData,
  hasMoreMenuData,
  isLoadingMoreMenuData,
  ...props
}) => {
  const [selectedMessages, setSelectedMessages] = useState([])
  const [rangeClickStart, setRangeClickStart] = useState()
  const {setOnFailure, setOnSuccess} = useContext(AlertManagerContext)
  const {setMultiselect, isSubmissionCommentsType} = useContext(ConversationContext)

  const [menuData, setMenuData] = useState([...props.conversations])
  const [lastConversationItem, setLastConversationItem] = useState(null)

  const provideConversationsForOnSelect = conversationIds => {
    const matchedConversations = props.conversations?.filter(c => conversationIds.includes(c._id))
    props.onSelect(matchedConversations)
  }

  const onItemRefSet = useCallback(refCurrent => {
    setLastConversationItem(refCurrent)
  }, [])
  /*
   * When conversations change, we need to re-provide the selectedConversations (CanvasInbox).
   * That way, other components have the latest state of the selected the conversations.
   * For example, MessageListActionContainer would have the correct actions.
   */
  useEffect(() => {
    provideConversationsForOnSelect(selectedMessages)
    setMenuData([...props.conversations])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.conversations, selectedMessages])

  // Toggle function for adding/removing IDs from state
  const updatedSelectedItems = _id => {
    setSelectedMessages(prevState => {
      const updatedSelectedMessage = [...prevState]
      if (prevState.includes(_id)) {
        const index = updatedSelectedMessage.indexOf(_id)
        updatedSelectedMessage.splice(index, 1)
      } else {
        updatedSelectedMessage.push(_id)
      }
      return updatedSelectedMessage
    })
  }

  // Creates an oberserver on the last scroll item to fetch more data when it becomes visible
  useEffect(() => {
    if (lastConversationItem && hasMoreMenuData) {
      const observer = new IntersectionObserver(
        ([menuItem]) => {
          if (menuItem.isIntersecting) {
            observer.unobserve(lastConversationItem)
            setLastConversationItem(null)
            fetchMoreMenuData()
          }
        },
        {
          root: null,
          rootMargin: '0px',
          threshold: 0.4
        }
      )

      if (lastConversationItem) {
        observer.observe(lastConversationItem)
      }

      return () => {
        if (lastConversationItem) observer.unobserve(lastConversationItem)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreMenuData, isSubmissionCommentsType, lastConversationItem])

  const removeFromSelectedConversations = _id => {
    const updatedSelectedMessage = selectedMessages.filter(id => id !== _id)
    setSelectedMessages([...updatedSelectedMessage])
  }

  // Key handler for MessageListItems
  const handleItemSelection = (e, _id, multiple) => {
    // Prevents selecting text when shift clicking to select range
    if (e.shiftKey) {
      window.document.getSelection().removeAllRanges()
    }
    if (e.shiftKey && rangeClickStart && multiple) {
      // Range Click
      rangeSelect(_id)
    } else if (multiple) {
      // MultiSelect
      setRangeClickStart(_id)
      updatedSelectedItems(_id)
    } else {
      // Single Select
      setRangeClickStart(_id)
      if (selectedMessages.includes(_id) && e.target.id.includes('Checkbox')) {
        removeFromSelectedConversations(_id)
        return
      }

      setMultiselect(e.target.id.includes('Checkbox'))

      if (e.target.id.includes('Checkbox')) {
        setSelectedMessages(prevSelectedMessages => [...prevSelectedMessages, _id])
      } else {
        setSelectedMessages([_id])
      }
    }
  }

  // Logic to select range of items
  const rangeSelect = rangeClickEnd => {
    let positionStart = null
    let positionEnd = null

    // Find position of start/ending messages
    for (let i = 0; i < props.conversations.length; i++) {
      const conversation = props.conversations[i]
      if (conversation._id === rangeClickStart) {
        positionStart = i
      } else if (conversation._id === rangeClickEnd) {
        positionEnd = i
      }

      if (positionStart !== null && positionEnd !== null) {
        break // Exit loop when both positions are found
      }
    }

    // Determine distance and direction of selection
    const direction = Math.sign(positionEnd - positionStart)
    const distance = Math.abs(positionStart - positionEnd) + 1

    // Walk array to add range selected ids
    const rangeSelectedIds = []
    for (let i = positionStart, j = distance; j > 0; i += direction, j--) {
      const conversation = props.conversations[i]
      rangeSelectedIds.push(conversation._id)
    }

    // Add newly selected Ids to list
    const updatedSelectedMessage = selectedMessages
    rangeSelectedIds.forEach(id => {
      if (!selectedMessages.includes(id)) {
        updatedSelectedMessage.push(id)
      }
    })
    setSelectedMessages([...updatedSelectedMessage])
  }

  const [readStateChangeConversationParticipants] = useMutation(UPDATE_CONVERSATION_PARTICIPANTS, {
    onCompleted(data) {
      if (data.updateConversationParticipants.errors) {
        setOnFailure(I18n.t('Read state change operation failed'))
      } else {
        setOnSuccess(
          I18n.t(
            {
              one: 'Read state Changed!',
              other: 'Read states Changed!'
            },
            {count: '1000'}
          )
        )
      }
    },
    onError() {
      setOnFailure(I18n.t('Read state change failed'))
    }
  })

  // Render no results found item
  const renderNoResultsFound = () => {
    return (
      <Flex
        textAlign="center"
        direction="column"
        margin="large 0 0 0"
        data-testid="conversation-list-no-messages"
      >
        <Flex.Item shouldGrow shouldShrink>
          <img src={InboxEmpty} alt="No messages Panda" />
        </Flex.Item>
        <Flex.Item>
          <Text color="primary" size="small" weight="bold">
            {I18n.t('No Conversations to Show')}
          </Text>
        </Flex.Item>
      </Flex>
    )
  }

  // Render individual menu items
  const renderMenuItem = (conversation, isLast) => {
    return (
      <View
        key={`conversation-${conversation._id}`}
        elementRef={el => {
          if (isLast) {
            onItemRefSet(el)
          }
        }}
      >
        <ConversationListItem
          id={conversation._id}
          conversation={conversation}
          isStarred={conversation?.label === 'starred'}
          isSelected={selectedMessages.includes(conversation._id)}
          isUnread={conversation?.workflowState === 'unread'}
          onSelect={handleItemSelection}
          onStar={props.onStar}
          key={conversation._id}
          readStateChangeConversationParticipants={
            isSubmissionCommentsType ? () => {} : readStateChangeConversationParticipants
          }
          textSize={props.textSize}
        />
      </View>
    )
  }

  // Loading renderer
  const renderLoading = () => {
    return (
      <View as="div" padding="xx-small" data-testid="menu-loading-spinner">
        <Flex width="100%" margin="xxx-small none xxx-small xxx-small">
          <Flex.Item align="start" margin="0 small 0 0">
            <Spinner renderTitle={I18n.t('Loading')} size="x-small" />
          </Flex.Item>
          <Flex.Item align="center" shouldGrow shouldShrink>
            <View>
              <Text>{I18n.t('Loading')}</Text>
            </View>
          </Flex.Item>
        </Flex>
      </View>
    )
  }

  // Memo which returns array of ConversationListItem's
  const renderedItems = useMemo(() => {
    if (menuData.length === 0 && !isLoading) {
      return renderNoResultsFound()
    }

    if (isLoading && !isLoadingMoreMenuData) {
      return renderLoading()
    }

    return menuData.map(conversation => {
      return renderMenuItem(conversation, conversation?.isLast)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuData])

  if (props.isError) {
    setOnFailure(I18n.t('Unable to load messages.'))
  }

  return (
    <View
      as="div"
      height="100%"
      overflowX="hidden"
      overflowY="auto"
      borderWidth="small"
      data-testid={props.datatestid}
    >
      {isLoading && !isLoadingMoreMenuData && renderLoading()}
      {(!isLoading || isLoadingMoreMenuData) && (
        <View as="div" height="100%" overflowX="hidden" overflowY="auto" borderWidth="small">
          {renderedItems}
          {isLoadingMoreMenuData && renderLoading()}
        </View>
      )}
    </View>
  )
}

ConversationListHolder.propTypes = {
  conversations: PropTypes.arrayOf(PropTypes.object),
  id: PropTypes.string,
  onSelect: PropTypes.func,
  onStar: PropTypes.func,
  textSize: PropTypes.string,
  datatestid: PropTypes.string,
  /**
   * Bool when conversations query is loading
   */
  isLoading: PropTypes.bool,
  /**
   * Bool when conversations query is fetching more
   */
  isLoadingMoreMenuData: PropTypes.bool,
  /**
   * Function to fetch next page
   */
  fetchMoreMenuData: PropTypes.func,
  /**
   * Bool to determine if there is a next page
   */
  hasMoreMenuData: PropTypes.bool,
  isError: PropTypes.bool
}

ConversationListHolder.defaultProps = {
  onSelect: () => {},
  onStar: () => {}
}
