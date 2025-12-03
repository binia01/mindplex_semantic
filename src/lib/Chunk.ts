import { JSDOM } from 'jsdom'

interface ParsedNode {
    tag: string
    text: string
    classes?: string[]
}

interface ContentChunk {
    title: string
    author: string
    date: string
    category: string
    index: number
    content: string
}

interface PostData {
    ID: number,
    post_author: string,
    post_date: string,
    post_date_gmt: string,
    post_content: string
    about_the_author: {
        author_role: string,
        author_bio: string
    }[],
    tag: {
        term_id: number,
        name: string,
        slug: string,
        term_group: number,
        term_taxonomy_id: number,
        taxonomy: string,
        description: string,
        parent: number,
        count: number,
        filter: string
    }[],
    category: {
        term_id: number,
        name: string,
        slug: string,
        term_group: number,
        term_taxonomy_id: number,
        taxonomy: string,
        description: string,
        parent: number,
        count: number,
        filter: string,
        cat_ID: number,
        category_count: number,
        category_description: string,
        cat_name: string,
        category_nicename: string,
        category_parent: number
    }[],
    post_title: string,
    post_excerpt: string,
    post_status: string,
    comment_status: string,
    ping_status: string,
    post_password: string,
    post_name: string,
    to_ping: string,
    pinged: string,
    post_modified: string,
    post_modified_gmt: string,
    post_content_filtered: string,
    post_parent: number,
    guid: string,
    menu_order: number,
    post_type: string,
    post_mime_type: string,
    comment_count: string,
    filter: string,
    origin_resource: string
}

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

        const category = Array.isArray(postData.category)
            ? postData.category.map(c => c.name).join(', ')
            : postData.category.name

        const author = Array.isArray(postData.post_author)
            ? postData.post_author.map(a => a.name).join(', ')
            : postData.post_author

        const baseChunk = {
            title: postData.post_title,
            author,
            date: postData.post_date,
            category
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
