import { JSDOM } from 'jsdom'
import { PostData, ParsedNode, ContentChunk } from '$src/types'
import { toNames } from '$src/utils'

export class Chunk {
    private allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'figcaption', 'td', 'th']
    private maxChunkSize = 3000
    private minChunkSize = 500

    processChunk(data: PostData): ContentChunk[] {
        const dom = new JSDOM(data.post_content)
        const results: ParsedNode[] = []

        this.walk(dom.window.document.body, results)

        return this.groupIntoChunks(results, data)
    }


    private walk(node: Node, results: ParsedNode[]) {

        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === child.ELEMENT_NODE) {
                const el = child as Element
                const tag = el.tagName.toLowerCase()
                const classes = el.className ? el.className.split(' ').filter(Boolean) : undefined

                if (this.allowedTags.includes(tag)) {
                    const text = el.textContent?.trim()
                    if (text) {
                        results.push({ tag, text, classes })
                    }
                } else if (tag === 'div') {
                    const isInterview = classes?.includes('wp-block-mp-general-interview-block')
                    const text = el.textContent?.trim()

                    if (isInterview) {
                        const isQuestion = classes?.includes('message-sent')
                        results.push({
                            tag: isQuestion ? 'interview_question' : 'interview_answer',
                            text,
                            classes
                        })
                    } else {
                        if (text) {
                            results.push({ tag, text, classes })
                        }
                        this.walk(el, results)
                    }
                }
            }
        }
    }

    groupIntoChunks(nodes: ParsedNode[], postData: PostData): ContentChunk[] {
        const chunks: ContentChunk[] = []
        let currentTexts: string[] = []
        let currentLength = 0

        console.log(Array.isArray(postData.category), postData.category)

        const category = toNames(postData.category)
        const author = toNames(postData.author_name)
        const tags = toNames(postData.tag)


        const baseChunk = {
            title: postData.post_title,
            author,
            date: postData.post_date,
            category,
            tags
        }

        const pushChunk = (content: string) => {
            chunks.push({ ...baseChunk, index: chunks.length, content })
        }

        for (const node of nodes) {
            let text = node.text

            if (node.tag === 'interview_question' || node.tag === 'interview_answer') {
                const colonIndex = text.indexOf(':')
                if (!(colonIndex > 0 && colonIndex < 20)) {
                    const prefix = node.tag === 'interview_question' ? 'Q: ' : 'A: '
                    text = prefix + text
                }
            }

            const nodeLength = text.length

            if (nodeLength > this.maxChunkSize) {
                if (currentTexts.length > 0) {
                    pushChunk(currentTexts.join('\n\n'))
                    currentTexts = []
                    currentLength = 0
                }
                pushChunk(text)
                continue
            }

            if (currentLength + nodeLength > this.maxChunkSize && currentTexts.length > 0) {
                pushChunk(currentTexts.join('\n\n'))
                currentTexts = []
                currentLength = 0
            }

            currentTexts.push(text)
            currentLength += nodeLength
        }

        if (currentTexts.length > 0) {
            const content = currentTexts.join('\n\n')

            if (content.length < this.minChunkSize && chunks.length > 0) {
                chunks[chunks.length - 1].content += '\n\n' + content
            } else {
                pushChunk(content)
            }
        }

        return chunks
    }

}
