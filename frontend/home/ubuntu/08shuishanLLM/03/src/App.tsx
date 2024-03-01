import React, { useEffect, useRef, useState, MutableRefObject } from 'react'
import MessageBox from './components/MessageBox'
import * as llm from './packages/llm'
import SessionItem from './components/SessionItem'
import {
    Toolbar,
    Box,
    Badge,
    Snackbar,
    List,
    ListSubheader,
    ListItemText,
    MenuList,
    IconButton,
    Button,
    ButtonGroup,
    Stack,
    Grid,
    MenuItem,
    ListItemIcon,
    Typography,
    Divider,
    TextField,
    useTheme,
    useMediaQuery,
    debounce,
} from '@mui/material'
import { Session, createSession, Message, createMessage } from './stores/types'
import useStore from './stores/store'
import SettingDialog from './dialogs/SettingDialog'
import ChatConfigDialog from './dialogs/ChatConfigDialog'
import SettingsIcon from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import * as prompts from './packages/prompts'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import Save from '@mui/icons-material/Save'
import CleanWidnow from './dialogs/CleanDialog'
import AboutDialog from './dialogs/AboutDialog'
import { ThemeSwitcherProvider } from './theme/ThemeSwitcher'
import { useTranslation } from 'react-i18next'
import icon from './assets/icon.png'
import { save } from '@tauri-apps/api/dialog'
import { writeTextFile } from '@tauri-apps/api/fs'
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp'
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown'
import SponsorChip from './components/SponsorChip'
import './styles/App.scss'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import type { DragEndEvent } from '@dnd-kit/core'
import {
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableItem } from './components/SortableItem'
import InputBox from './components/InputBox'
import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

function Main() {
    const { t } = useTranslation()
    const store = useStore()
    const sensors = useSensors(
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    )

    const sortedSessions = sortSessions(store.chatSessions)
    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over) {
            return
        }
        if (active.id !== over.id) {
            const oldIndex = sortedSessions.findIndex(({ id }) => id === active.id)
            const newIndex = sortedSessions.findIndex(({ id }) => id === over.id)
            const newReversed = arrayMove(sortedSessions, oldIndex, newIndex)
            store.setSessions(sortSessions(newReversed))
        }
    }

    // 是否展示设置窗口
    const [openSettingDialog, setOpenSettingDialog] = React.useState(false)
    useEffect(() => {
        if (store.needSetting) {
            setOpenSettingDialog(true)
        }
    }, [store.needSetting])

    // 是否展示相关信息的窗口
    const [openAboutDialog, setOpenAboutDialog] = React.useState(false)

    // 是否展示菜单栏
    const theme = useTheme()
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [showMenu, setShowMenu] = React.useState(!isSmallScreen)

    const messageListRef = useRef<HTMLDivElement>(null)
    const messageScrollRef = useRef<{ msgId: string; smooth?: boolean } | null>(null)
    useEffect(() => {
        if (!messageScrollRef.current) {
            return
        }
        if (!messageListRef.current) {
            return
        }
        const container = messageListRef.current
        const element = document.getElementById(messageScrollRef.current.msgId)
        if (!container || !element) {
            return
        }
        const elementRect = element.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const isInsideLeft = elementRect.left >= containerRect.left
        const isInsideRight = elementRect.right <= containerRect.right
        const isInsideTop = elementRect.top >= containerRect.top
        const isInsideBottom = elementRect.bottom <= containerRect.bottom
        if (isInsideLeft && isInsideRight && isInsideTop && isInsideBottom) {
            return
        }
        // 平滑滚动
        element.scrollIntoView({
            behavior: messageScrollRef.current.smooth ? 'smooth' : 'auto',
            block: 'end',
            inline: 'nearest',
        })
    })
    // stop auto-scroll when user scroll
    useEffect(() => {
        if (!messageListRef.current) {
            return
        }
        messageListRef.current.addEventListener('wheel', function (e: any) {
            messageScrollRef.current = null
        })
    }, [])

    // 切换到当前会话，自动滚动到最后一条消息
    useEffect(() => {
        messageListToBottom()
    }, [store.currentSession.id])

    // show scroll to top or bottom button when user scroll
    const [atScrollTop, setAtScrollTop] = React.useState(false)
    const [atScrollBottom, setAtScrollBottom] = React.useState(false)
    const [needScroll, setNeedScroll] = React.useState(false)

    const itemData = [
        {
            img: 'https://markdown-picture-1302861826.cos.ap-shanghai.myqcloud.com/img/2024/02/20/20240220203614-1.png',
            title: 'ECNU'
        },
        {
            img: 'https://markdown-picture-1302861826.cos.ap-shanghai.myqcloud.com/img/2024/02/20/20240220215113.png',
            title: 'DATA'
        }
    ]

    useEffect(() => {
        if (!messageListRef.current) {
            return
        }
        const handleScroll = () => {
            if (!messageListRef.current) {
                return
            }
            const { scrollTop, scrollHeight, clientHeight } = messageListRef.current
            if (scrollTop === 0) {
                setAtScrollTop(true)
                setAtScrollBottom(false)
            } else if (scrollTop + clientHeight === scrollHeight) {
                setAtScrollTop(false)
                setAtScrollBottom(true)
            } else {
                setAtScrollTop(false)
                setAtScrollBottom(false)
            }
            setNeedScroll(scrollHeight > clientHeight)
        }

        handleScroll()
        messageListRef.current.addEventListener('scroll', debounce(handleScroll, 100))
    }, [])
    const messageListToTop = () => {
        if (!messageListRef.current) {
            return
        }
        messageListRef.current.scrollTop = 0
    }
    const messageListToBottom = () => {
        if (!messageListRef.current) {
            return
        }
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }

    // 会话名称自动生成
    useEffect(() => {
        if (
            store.currentSession.name === 'Untitled' &&
            store.currentSession.messages.findIndex((msg) => msg.role === 'assistant') !== -1
        ) {
            generateName(store.currentSession)
        }
    }, [store.currentSession.messages])

    const codeBlockCopyEvent = useRef((e: Event) => {
        const target: HTMLElement = e.target as HTMLElement

        const isCopyActionClassName = target.className === 'copy-action'
        const isCodeBlockParent = target.parentElement?.parentElement?.className === 'code-block-wrapper'

        // check is copy action button
        if (!(isCopyActionClassName && isCodeBlockParent)) {
            return
        }

        // got codes
        const content = target?.parentNode?.parentNode?.querySelector('code')?.innerText ?? ''

        // do copy
        // * thats lines copy from copy block content action
        navigator.clipboard.writeText(content)
        store.addToast(t('copied to clipboard'))
    })

    // bind code block copy event on mounted
    useEffect(() => {
        document.addEventListener('click', codeBlockCopyEvent.current)

        return () => {
            document.removeEventListener('click', codeBlockCopyEvent.current)
        }
    }, [])

    const [configureChatConfig, setConfigureChatConfig] = React.useState<Session | null>(null)

    const [sessionClean, setSessionClean] = React.useState<Session | null>(null)

    const editCurrentSession = () => {
        setConfigureChatConfig(store?.currentSession)
    }
    const generateName = async (session: Session) => {
        llm.chat(
            store.settings.openaiKey,
            store.settings.apiHost,
            store.settings.maxContextSize,
            store.settings.maxTokens,
            store.settings.model,
            store.settings.temperature,
            prompts.nameConversation(session.messages.slice(0, 3)),
            ({ text: name }) => {
                name = name.replace(/['"“”]/g, '')
                session.name = name
                store.updateChatSession(session)
            },
            (err) => {
                console.log(err)
            },
        )
    }
    const saveSession = async (session: Session) => {
        const filePath = await save({
            filters: [
                {
                    name: 'Export',
                    extensions: ['md'],
                },
            ],
        })
        if (filePath) {
            const content = session.messages
                .map((msg) => `**${msg.role}**:\n${msg.content}`)
                .join('\n\n--------------------\n\n')
            await writeTextFile(filePath!, content)
        }
    }

    const generate = async (session: Session, promptMsgs: Message[], targetMsg: Message) => {
        messageScrollRef.current = { msgId: targetMsg.id, smooth: false }
        await llm.chat(
            store.settings.openaiKey,
            store.settings.apiHost,
            store.settings.maxContextSize,
            store.settings.maxTokens,
            store.settings.model,
            store.settings.temperature,
            promptMsgs,
            ({ text, cancel }) => {
                for (let i = 0; i < session.messages.length; i++) {
                    if (session.messages[i].id === targetMsg.id) {
                        session.messages[i] = {
                            ...session.messages[i],
                            content: text,
                            cancel,
                            model: store.settings.model,
                            generating: true,
                        }
                        break
                    }
                }
                store.updateChatSession(session)
            },
            (err) => {
                for (let i = 0; i < session.messages.length; i++) {
                    if (session.messages[i].id === targetMsg.id) {
                        session.messages[i] = {
                            ...session.messages[i],
                            content: t('api request failed:') + ' \n```\n' + err.message + '\n```',
                            model: store.settings.model,
                            generating: false,
                        }
                        break
                    }
                }
                store.updateChatSession(session)
            },
        )
        for (let i = 0; i < session.messages.length; i++) {
            if (session.messages[i].id === targetMsg.id) {
                session.messages[i] = {
                    ...session.messages[i],
                    generating: false,
                }
                break
            }
        }
        store.updateChatSession(session)

        messageScrollRef.current = null
    }

    const [quoteCache, setQuoteCache] = useState('')

    const sessionListRef = useRef<HTMLDivElement>(null)
    const handleCreateNewSession = () => {
        store.createEmptyChatSession()
        if (sessionListRef.current) {
            sessionListRef.current.scrollTo(0, 0)
        }
    }

    const textareaRef = useRef<HTMLTextAreaElement>(null)

    return (
        <Box className="App">
            <Grid
                container
                sx={{
                    height: '100%',
                }}
            >
                {showMenu && (
                    <Grid
                        item
                        sx={{
                            height: '100%',
                            [theme.breakpoints.down('sm')]: {
                                position: 'absolute',
                                zIndex: 100,
                                left: '20px',
                                right: 0,
                                bottom: 0,
                                top: 0,
                            },
                        }}
                    >
                        <Stack
                            className="ToolBar"
                            sx={{
                                width: '210px',
                                height: '100%',
                                [theme.breakpoints.down('sm')]: {
                                    position: 'absolute',
                                    zIndex: 1,
                                },
                            }}
                            spacing={2}
                        >
                            <Toolbar
                                variant="dense"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                }}
                            >
                                <img
                                    src={icon}
                                    style={{
                                        width: '35px',
                                        height: '35px',
                                        marginRight: '5px',
                                    }}
                                />
                                <Typography variant="h5" color="inherit" component="div" style={{ fontSize: '24px' }}>
                                    水杉大模型
                                </Typography>
                            </Toolbar>

                            <MenuList
                                sx={{
                                    width: '100%',
                                    position: 'relative',
                                    overflow: 'auto',
                                    height: '60vh',
                                    '& ul': { padding: 0 },
                                }}
                                className="scroll"
                                subheader={<ListSubheader component="div">{t('chat')}</ListSubheader>}
                                component="div"
                                ref={sessionListRef}
                            >
                                <DndContext
                                    modifiers={[restrictToVerticalAxis]}
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext items={sortedSessions} strategy={verticalListSortingStrategy}>
                                        {sortedSessions.map((session, ix) => (
                                            <SortableItem key={session.id} id={session.id}>
                                                <SessionItem
                                                    key={session.id}
                                                    selected={store.currentSession.id === session.id}
                                                    session={session}
                                                    switchMe={() => {
                                                        store.switchCurrentSession(session)
                                                        textareaRef?.current?.focus()
                                                    }}
                                                    deleteMe={() => store.deleteChatSession(session)}
                                                    copyMe={() => {
                                                        const newSession = createSession(session.name + ' copied')
                                                        newSession.messages = session.messages
                                                        store.createChatSession(newSession, ix)
                                                    }}
                                                    switchStarred={() => {
                                                        store.updateChatSession({
                                                            ...session,
                                                            starred: !session.starred,
                                                        })
                                                    }}
                                                    editMe={() => setConfigureChatConfig(session)}
                                                />
                                            </SortableItem>
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            </MenuList>

                            <Divider />

                            <MenuList>
                                <MenuItem onClick={handleCreateNewSession}>
                                    <ListItemIcon>
                                        <IconButton>
                                            <AddIcon fontSize="small" />
                                        </IconButton>
                                    </ListItemIcon>
                                    <ListItemText>{t('new chat')}</ListItemText>
                                    <Typography variant="body2" color="text.secondary">
                                        {/* ⌘N */}
                                    </Typography>
                                </MenuItem>
                                <MenuItem
                                    onClick={() => {
                                        setOpenSettingDialog(true)
                                    }}
                                >
                                    <ListItemIcon>
                                        <IconButton>
                                            <SettingsIcon fontSize="small" />
                                        </IconButton>
                                    </ListItemIcon>
                                    <ListItemText>{t('settings')}</ListItemText>
                                    <Typography variant="body2" color="text.secondary">
                                        {/* ⌘N */}
                                    </Typography>
                                </MenuItem>

                                <MenuItem onClick={() => setOpenAboutDialog(true)}>
                                    <ListItemIcon>
                                        <IconButton>
                                            <InfoOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </ListItemIcon>
                                    <ListItemText>
                                        <Badge
                                            color="primary"
                                            variant="dot"
                                            invisible={!store.needCheckUpdate}
                                            sx={{ paddingRight: '8px' }}
                                        >
                                            <Typography sx={{ opacity: 0.5 }}>
                                                {t('About')} ({store.version})
                                            </Typography>
                                        </Badge>
                                    </ListItemText>
                                </MenuItem>
                            </MenuList>
                        </Stack>
                        <Box
                            onClick={() => setShowMenu(false)}
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                [theme.breakpoints.up('sm')]: {
                                    display: 'none',
                                },
                            }}
                        ></Box>
                    </Grid>
                )}
                <Grid
                    item
                    xs
                    sx={{
                        width: '0px',
                        height: '100%',
                    }}
                >
                    <Stack
                        sx={{
                            height: '100%',
                            position: 'relative',
                        }}
                    >
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
                            <ImageList sx={{ width: 'auto', height: 100, flexWrap: 'nowrap', transform: 'translateZ(0)' }} cols={2} gap={8}>
                                {itemData.map((item) => (
                                <ImageListItem key={item.img}>
                                    <img
                                    src={`${item.img}?w=164&h=164&fit=crop&auto=format`}
                                    srcSet={`${item.img}?w=164&h=164&fit=crop&auto=format&dpr=2 2x`}
                                    alt={item.title}
                                    loading="lazy"
                                    style={{ height: '100px', width: 'auto' }} // 保持宽高比不变
                                    />
                                </ImageListItem>
                                ))}
                            </ImageList>
                            </div>
                        <Typography variant="h4" component="div" sx={{ textAlign: 'center', mt: 1 }}>
                            水杉大模型
                        </Typography>
                        <Toolbar style={{ padding: '0 10px' }}>
                            <IconButton onClick={() => setShowMenu(!showMenu)}>
                                {!showMenu ? (
                                    <img
                                        src={icon}
                                        style={{
                                            width: '30px',
                                            height: '30px',
                                        }}
                                    />
                                ) : (
                                    <MenuOpenIcon style={{ fontSize: '26px' }} />
                                )}
                            </IconButton>
                            {/* Untitled */}
                            <Typography
                                variant="h6"
                                color="inherit"
                                component="div"
                                noWrap
                                sx={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                <span
                                    onClick={() => {
                                        editCurrentSession()
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {store.currentSession.name}
                                </span>
                            </Typography>
                            <SponsorChip sessionId={store.currentSession.id} />
                            <IconButton
                                edge="start"
                                color="inherit"
                                aria-label="menu"
                                sx={{ mr: 2 }}
                                onClick={() => setSessionClean(store.currentSession)}
                            >
                                <CleaningServicesIcon />
                            </IconButton>
                            <IconButton
                                edge="start"
                                color="inherit"
                                aria-label="menu"
                                sx={{}}
                                onClick={() => saveSession(store.currentSession)}
                            >
                                <Save />
                            </IconButton>
                        </Toolbar>
                        <List
                            className="scroll"
                            sx={{
                                bgcolor: 'background.paper',
                                overflow: 'auto',
                                '& ul': { padding: 0 },
                                height: '100%',
                            }}
                            component="div"
                            ref={messageListRef}
                        >
                            {store.currentSession.messages.map((msg, ix) => (
                                <MessageBox
                                    id={msg.id}
                                    key={msg.id}
                                    msg={msg}
                                    showWordCount={store.settings.showWordCount || false}
                                    showTokenCount={store.settings.showTokenCount || false}
                                    showModelName={store.settings.showModelName || false}
                                    setMsg={(updated) => {
                                        store.currentSession.messages = store.currentSession.messages.map((m) => {
                                            if (m.id === updated.id) {
                                                return updated
                                            }
                                            return m
                                        })
                                        store.updateChatSession(store.currentSession)
                                    }}
                                    delMsg={() => {
                                        store.currentSession.messages = store.currentSession.messages.filter(
                                            (m) => m.id !== msg.id,
                                        )
                                        store.updateChatSession(store.currentSession)
                                    }}
                                    refreshMsg={() => {
                                        if (msg.role === 'assistant') {
                                            const promptMsgs = store.currentSession.messages.slice(0, ix)
                                            generate(store.currentSession, promptMsgs, msg)
                                        } else {
                                            const promptsMsgs = store.currentSession.messages.slice(0, ix + 1)
                                            const newAssistantMsg = createMessage('assistant', '....')
                                            const newMessages = [...store.currentSession.messages]
                                            newMessages.splice(ix + 1, 0, newAssistantMsg)
                                            store.currentSession.messages = newMessages
                                            store.updateChatSession(store.currentSession)
                                            generate(store.currentSession, promptsMsgs, newAssistantMsg)
                                            messageScrollRef.current = { msgId: newAssistantMsg.id, smooth: true }
                                        }
                                    }}
                                    copyMsg={() => {
                                        navigator.clipboard.writeText(msg.content)
                                        store.addToast(t('copied to clipboard'))
                                    }}
                                    quoteMsg={() => {
                                        let input = msg.content
                                            .split('\n')
                                            .map((line: any) => `> ${line}`)
                                            .join('\n')
                                        input += '\n\n-------------------\n\n'
                                        setQuoteCache(input)
                                    }}
                                />
                            ))}
                        </List>
                        <Box sx={{ padding: '20px 0', position: 'relative' }}>
                            {needScroll && (
                                <ButtonGroup
                                    sx={{
                                        position: 'absolute',
                                        right: '0.2rem',
                                        top: '-5.5rem',
                                        opacity: 0.6,
                                    }}
                                    orientation="vertical"
                                >
                                    <IconButton
                                        onClick={() => messageListToTop()}
                                        sx={{ visibility: atScrollTop ? 'hidden' : 'visible' }}
                                    >
                                        <ArrowCircleUpIcon />
                                    </IconButton>
                                    <IconButton
                                        onClick={() => messageListToBottom()}
                                        sx={{ visibility: atScrollBottom ? 'hidden' : 'visible' }}
                                    >
                                        <ArrowCircleDownIcon />
                                    </IconButton>
                                </ButtonGroup>
                            )}
                            <InputBox
                                quoteCache={quoteCache}
                                setQuotaCache={setQuoteCache}
                                onSubmit={async (newUserMsg: Message, needGenerating = true) => {
                                    if (needGenerating) {
                                        const promptsMsgs = [...store.currentSession.messages, newUserMsg]
                                        const newAssistantMsg = createMessage('assistant', '....')
                                        store.currentSession.messages = [
                                            ...store.currentSession.messages,
                                            newUserMsg,
                                            newAssistantMsg,
                                        ]
                                        store.updateChatSession(store.currentSession)
                                        generate(store.currentSession, promptsMsgs, newAssistantMsg)
                                        messageScrollRef.current = { msgId: newAssistantMsg.id, smooth: true }
                                    } else {
                                        store.currentSession.messages = [...store.currentSession.messages, newUserMsg]
                                        store.updateChatSession(store.currentSession)
                                        messageScrollRef.current = { msgId: newUserMsg.id, smooth: true }
                                    }
                                }}
                                textareaRef={textareaRef}
                            />
                        </Box>
                    </Stack>
                </Grid>

                <SettingDialog
                    open={openSettingDialog}
                    settings={store.settings}
                    save={(settings) => {
                        store.setSettings(settings)
                        setOpenSettingDialog(false)
                        if (settings.fontSize !== store.settings.fontSize) {
                            store.addToast(t('font size changed, effective after next launch'))
                        }
                    }}
                    close={() => setOpenSettingDialog(false)}
                />
                <AboutDialog
                    open={openAboutDialog}
                    version={store.version}
                    lang={store.settings.language}
                    close={() => setOpenAboutDialog(false)}
                />
                {configureChatConfig !== null && (
                    <ChatConfigDialog
                        open={configureChatConfig !== null}
                        session={configureChatConfig}
                        save={(session) => {
                            store.updateChatSession(session)
                            setConfigureChatConfig(null)
                        }}
                        close={() => setConfigureChatConfig(null)}
                    />
                )}
                {sessionClean !== null && (
                    <CleanWidnow
                        open={sessionClean !== null}
                        session={sessionClean}
                        save={(session) => {
                            sessionClean.messages.forEach((msg) => {
                                msg?.cancel?.()
                            })

                            store.updateChatSession(session)
                            setSessionClean(null)
                        }}
                        close={() => setSessionClean(null)}
                    />
                )}
                {store.toasts.map((toast) => (
                    <Snackbar
                        key={toast.id}
                        open
                        onClose={() => store.removeToast(toast.id)}
                        message={toast.content}
                        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    />
                ))}
            </Grid>
        </Box>
    )
}

function sortSessions(sessions: Session[]): Session[] {
    const reversed: Session[] = []
    const pinned: Session[] = []
    for (const sess of sessions) {
        if (sess.starred) {
            pinned.push(sess)
            continue
        }
        reversed.unshift(sess)
    }
    return pinned.concat(reversed)
}

export default function App() {
    return (
        <ThemeSwitcherProvider>
            <Main />
        </ThemeSwitcherProvider>
    )
}
