import './App.css';
import React, { Component } from 'react';
import { Button, Icon, Divider, Container, Progress, Header, List, Accordion, TextArea, Form } from 'semantic-ui-react';
import Dropzone from 'react-dropzone';
import Tesseract from 'tesseract.js';

const PDFJS = window.pdfjsLib;

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

class App extends Component {
  constructor(props) {
    super(props);
    this.onDrop = (files) => {
      this.setState({ files });
      this.readFiles(this.state.files);
    };

    this.onReject = (reject) => {
      const errors = [];
      reject.forEach(file => {
        errors.push(`Error: ${file['file']['name']}, ${file['errors'][0]['message']}`);
      });
      this.setState({ reject: errors });
      setTimeout(() => {
        this.setState({ reject: [] });
      }, 5000);
    }

    this.handleClick = (e, titleProps) => {
      const { index } = titleProps
      const { activeDetails } = this.state
      const newIndex = activeDetails === index ? -1 : index;

      this.setState({ activeDetails: newIndex })
    }

    this.state = {
      files: [],
      progress: {},
      inProgress: false,
      reject: [],
      activeDetails: -1
    };

    this.acceptedFiles = ['application/pdf', 'image/*'];
  }

  processPDF = (file, data) => {
    PDFJS.getDocument(data).promise
      .then(pdf => {
        for (let i = 1; i <= pdf["numPages"]; i++) {
          pdf.getPage(i).then(page => {
            var viewport = page.getViewport({ scale: 1 });

            // Prepare canvas using PDF page dimensions
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF page into canvas context
            var renderContext = {
              canvasContext: context,
              viewport: viewport
            };

            page.render(renderContext).promise
              .then(() => {
                const dataURL = canvas.toDataURL('image/png');
                this.processIMG(file, dataURL, i);
            });
          });
        }
      });
  }

  processIMG = (file, data, page) => {
    const key = `${file.name}${page}`;
    Tesseract.recognize(
      data,
      'eng',
      {
        logger: m => {
          this.setState(state => ({ progress: { ...this.state.progress, [key]: { name: file.name, page: page, status: m.status, percent: (m.progress * 100) }}}));
        }
      }
    )
    .then(({ data: { text, confidence, lines, words, paragraphs, symbols } }) => {
      setTimeout(() => {
        this.setState(state => ({ progress: { ...this.state.progress, [key]: { 
          name: file.name, 
          page: page, 
          text: text, 
          confidence: confidence,
          lines: lines.length,
          words: words.length,
          paragraphs: paragraphs.length,
          symbols: symbols.length
        }}}));
      }, 1000);
    });
  }

  readFiles = (files) => {
    files.forEach(file => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);

      reader.onabort = () => console.log('file reading was aborted');
      reader.onerror = () => console.log('file reading has failed');
      reader.onload = () => {
        if (file.type === 'application/pdf') {
          this.processPDF(file, reader.result);
        } else {
          this.processIMG(file, reader.result);
        }
      }
    });
  }

  render() {
    const files = this.state.files.map(file => (
      <List.Item>{file.name} - {formatBytes(file.size)}</List.Item>
    ));

    const progress = Object.entries(this.state.progress)
      .sort(([a], [b]) => a['page'] - b['page'])
      .map(([key, element]) => (
      <div>
        {(element.page && <b className="unselectable">{element.name} - page {element.page}</b>)
          || <b className="unselectable">{element.name}</b>}
        {element.text && 
        <Accordion className="unselectable">
          <Accordion.Title
            active={this.state.activeDetails === key}
            index={key}
            onClick={this.handleClick}
          >
            <Icon name="info circle"/>
            Details
          </Accordion.Title>
          <Accordion.Content active={this.state.activeDetails === key}>
            <List celled relaxed horizontal>
              <List.Item>Confidence: {element.confidence}%</List.Item>
              <List.Item>Lines: {element.lines}</List.Item>
              <List.Item>Words: {element.words}</List.Item>
              <List.Item>Symbols: {element.symbols}</List.Item>
            </List>
          </Accordion.Content>
        </Accordion>}
        {!element.text && <Progress percent={element.percent} indicating>{element.status}</Progress>}
        {element.text && 
        <Form>
          <TextArea value={element.text}/>
        </Form>}
        <br />
      </div>
    ));

    return (
      <div className="App">
        <div className="hero">
          <Header as='h1' content="OCR Text Grabber" className="top-header" textAlign='center' />
          <Container textAlign="center">
            <Dropzone onDropAccepted={this.onDrop} onDropRejected={(event) => this.onReject(event)} accept={this.acceptedFiles}>
              {({ getRootProps, getInputProps }) => (
                <section className="container">
                  <div {...getRootProps({className: 'dropzone'})}>
                    <input {...getInputProps()} />
                    <p>Drag 'n' Drop Files Here</p>
                    <p>or</p>
                    <Button icon labelPosition="left" as="label" htmlFor="file" type="button">
                      <Icon name="upload" />
                      Upload Files
                    </Button>
                    {this.state.reject.map(msg => (<div><br/><em style={{ color: 'red' }}>{msg}</em></div>))}
                  </div>
                  {/* <br /> */}
                  <Divider />
                  <aside>
                    <h4>Files</h4>
                    <List bulleted>{files}</List>
                  </aside>
                </section>
              )}
            </Dropzone>
          </Container>
          <Divider />
        </div>
        <Container className="contents">
          <br />
          {progress}
        </Container>
      </div>
    );
  }
}

export default App;
